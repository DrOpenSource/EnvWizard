import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as os from 'node:os';
import { PortInfo } from '../shared/types.js';

const execAsync = promisify(exec);

export const DEFAULT_DEV_PORTS = [
  3000, 3001, 3002,
  5173, 5174,
  8000, 8080, 8888,
  5432, 6379, 27017,
  4200, 4000
];

export class PortScanner {
  private platform: NodeJS.Platform;
  /** False when the last scan could not run (e.g. lsof/ss missing), so callers never report a false "All Clear". */
  public lastScanOk = true;

  constructor(platformOverride?: NodeJS.Platform) {
    this.platform = platformOverride || os.platform();
  }

  /**
   * Scans a specific port and returns PortInfo if it is occupied, or null if free.
   */
  async scanPort(port: number): Promise<PortInfo | null> {
    const allOccupied = await this.scanAllOccupied();
    const match = allOccupied.find((info) => info.port === port && info.state === 'LISTENING');
    return match || null;
  }

  /**
   * Scans a standard list of developer ports.
   */
  async scanDevPorts(ports: number[] = DEFAULT_DEV_PORTS): Promise<PortInfo[]> {
    const portSet = new Set(ports);
    const allOccupied = await this.scanAllOccupied();
    return allOccupied.filter((info) => portSet.has(info.port) && info.state === 'LISTENING');
  }

  /**
   * Scans all occupied listening ports on the operating system.
   */
  async scanAllOccupied(): Promise<PortInfo[]> {
    let results: PortInfo[];
    try {
      if (this.platform === 'win32') {
        const { stdout } = await execAsync('netstat -ano -p tcp', { timeout: 5000 });
        results = this.parseWindowsNetstat(stdout);
      } else {
        results = await this.scanUnix();
      }
      this.lastScanOk = true;
    } catch {
      this.lastScanOk = false;
      return [];
    }
    return dedupe(results);
  }

  /**
   * macOS & Linux: prefer lsof, fall back to `ss` (lsof is missing on many minimal Linux installs).
   */
  private async scanUnix(): Promise<PortInfo[]> {
    try {
      const { stdout } = await execAsync('lsof -nP -iTCP -sTCP:LISTEN', { timeout: 5000 });
      return this.parseUnixLsof(stdout);
    } catch (err: unknown) {
      const e = err as { code?: number | string; stdout?: string };
      // lsof exits 1 with empty output when nothing is listening
      if (e.code === 1 && !e.stdout?.trim()) {
        return [];
      }
      if (this.platform !== 'linux') {
        throw err;
      }
    }
    const { stdout } = await execAsync('ss -ltnpH', { timeout: 5000 });
    return this.parseLinuxSs(stdout);
  }

  /**
   * Parses Windows `netstat -ano -p tcp` output.
   * Example line:
   * TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       14220
   * TCP    [::]:5173              [::]:0                 LISTENING       8412
   */
  parseWindowsNetstat(output: string): PortInfo[] {
    const results: PortInfo[] = [];
    const lines = output.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('TCP')) {
        continue;
      }

      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        const localAddress = parts[1];
        const state = parts[3];
        const pidStr = parts[4];

        if (state !== 'LISTENING') {
          continue;
        }

        const portMatch = localAddress.match(/:(\d+)$/);
        const pid = parseInt(pidStr, 10);

        if (portMatch && !isNaN(pid) && pid > 0) {
          const port = parseInt(portMatch[1], 10);
          results.push({
            port,
            pid,
            protocol: 'TCP',
            state: 'LISTENING',
          });
        }
      }
    }

    return results;
  }

  /**
   * Parses macOS & Linux `lsof -nP -iTCP -sTCP:LISTEN` output.
   * Example line:
   * COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
   * node    14220 user   23u  IPv6 0x1234      0t0  TCP *:3000 (LISTEN)
   */
  parseUnixLsof(output: string): PortInfo[] {
    const results: PortInfo[] = [];
    const lines = output.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('COMMAND') || !line) {
        continue;
      }

      const parts = line.split(/\s+/);
      if (parts.length >= 9) {
        const processName = parts[0];
        const pid = parseInt(parts[1], 10);
        const nameColumn = parts[8]; // e.g. *:3000 or 127.0.0.1:5173

        const portMatch = nameColumn.match(/:(\d+)$/);
        if (portMatch && !isNaN(pid) && pid > 0) {
          const port = parseInt(portMatch[1], 10);
          results.push({
            port,
            pid,
            protocol: 'TCP',
            state: 'LISTENING',
            processName,
          });
        }
      }
    }

    return results;
  }

  /**
   * Parses Linux `ss -ltnpH` output.
   * Example line:
   * LISTEN 0      511          *:3000         *:*    users:(("node",pid=14220,fd=19))
   */
  parseLinuxSs(output: string): PortInfo[] {
    const results: PortInfo[] = [];

    for (const rawLine of output.split('\n')) {
      const parts = rawLine.trim().split(/\s+/);
      if (parts.length < 4 || parts[0] !== 'LISTEN') {
        continue;
      }

      const portMatch = parts[3].match(/:(\d+)$/);
      const procMatch = rawLine.match(/users:\(\("([^"]+)",pid=(\d+)/);
      if (portMatch && procMatch) {
        results.push({
          port: parseInt(portMatch[1], 10),
          pid: parseInt(procMatch[2], 10),
          protocol: 'TCP',
          state: 'LISTENING',
          processName: procMatch[1],
        });
      }
    }

    return results;
  }
}

/**
 * A server bound on both IPv4 and IPv6 shows up twice; keep one row per port + PID.
 */
function dedupe(ports: PortInfo[]): PortInfo[] {
  const seen = new Set<string>();
  return ports.filter((p) => {
    const id = `${p.port}:${p.pid}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
