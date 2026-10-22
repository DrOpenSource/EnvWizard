import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as os from 'node:os';
import { UnjamResult } from '../shared/types.js';
import { PortScanner } from './PortScanner.js';
import { ProcessInspector } from './ProcessInspector.js';

const execAsync = promisify(exec);

// Names are compared lowercase with any ".exe" suffix removed (see normalizeProcessName).
export const PROTECTED_PROCESS_NAMES = new Set([
  'system',
  'system idle process',
  'registry',
  'smss',
  'csrss',
  'wininit',
  'services',
  'lsass',
  'svchost',
  'explorer',
  'windowserver',
  'launchd',
  'kernel_task',
  'systemd',
  'init',
  'sshd',
  'code',
  'code - insiders',
  'cursor',
  'antigravity',
  'windsurf',
  'dockerd',
  'docker desktop',
  'containerd',
  // Docker / WSL port relays: the real server lives inside the container or WSL,
  // killing the relay breaks Docker Desktop or WSL networking instead of freeing the port.
  'com.docker.backend',
  'vpnkit',
  'docker-proxy',
  'wslrelay',
  'wslhost',
]);

// IDE helper processes (macOS "Code Helper (Plugin)", etc.) and Docker internals.
const PROTECTED_NAME_PREFIXES = ['code helper', 'cursor helper', 'antigravity helper', 'windsurf helper', 'com.docker.'];

// Local databases: listed in the radar but never stopped by Clean Slate.
export const DATABASE_PROCESS_NAMES = new Set([
  'postgres',
  'mysqld',
  'mariadbd',
  'mongod',
  'redis-server',
  'memurai',
]);

export class SafetyShieldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafetyShieldError';
  }
}

export function normalizeProcessName(processName: string): string {
  const base = processName.trim().split(/[\\/]/).pop() || '';
  return base.toLowerCase().replace(/\.exe$/, '');
}

export function isDatabaseProcess(processName: string): boolean {
  return DATABASE_PROCESS_NAMES.has(normalizeProcessName(processName));
}

export class ProcessTerminator {
  private platform: NodeJS.Platform;
  private scanner: PortScanner;
  private inspector: ProcessInspector;

  constructor(platformOverride?: NodeJS.Platform) {
    this.platform = platformOverride || os.platform();
    this.scanner = new PortScanner(this.platform);
    this.inspector = new ProcessInspector(this.platform);
  }

  /**
   * Checks whether a process name or PID is protected by the safety shield.
   */
  isProtected(processName: string, pid: number): boolean {
    if (pid <= 4) {
      return true; // System Idle & System kernel
    }

    if (pid === process.pid) {
      return true; // Never kill self
    }

    const normalized = normalizeProcessName(processName);
    return (
      PROTECTED_PROCESS_NAMES.has(normalized) ||
      PROTECTED_NAME_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    );
  }

  /**
   * Safely frees a port by identifying its holding process, verifying safety,
   * attempting graceful shutdown, and falling back to force termination if required.
   */
  async unjamPort(port: number): Promise<UnjamResult> {
    const portInfo = await this.scanner.scanPort(port);

    if (!portInfo) {
      return {
        success: true,
        port,
        pid: 0,
        message: `Port ${port} is already free.`,
        graceful: true,
      };
    }

    const { pid } = portInfo;
    const processDetails = await this.inspector.inspectProcess(pid);
    const processName = processDetails.name || 'Unknown';

    if (this.isProtected(processName, pid)) {
      throw new SafetyShieldError(
        `Safety Shield: port ${port} is held by "${processName}", a protected program (system, editor, Docker or WSL). EnvWizard won't stop it.`
      );
    }

    let graceful = true;

    try {
      // Stage 1: Graceful polite shutdown
      if (this.platform === 'win32') {
        // Polite close on Windows
        await execAsync(`taskkill /PID ${pid} /T`, { timeout: 2000 }).catch(() => {});
      } else {
        // SIGTERM on Unix
        process.kill(pid, 'SIGTERM');
      }

      // Wait 800ms for graceful release
      await new Promise((r) => setTimeout(r, 800));

      // Verify if port is released
      const stillOccupied = await this.scanner.scanPort(port);
      if (stillOccupied && stillOccupied.pid === pid) {
        // Stage 2: Force eviction
        graceful = false;
        if (this.platform === 'win32') {
          await execAsync(`taskkill /F /PID ${pid} /T`, { timeout: 3000 });
        } else {
          process.kill(pid, 'SIGKILL');
        }

        // Wait another 300ms
        await new Promise((r) => setTimeout(r, 300));
      }

      // Success means the port is actually free, not just that the original PID is gone:
      // auto-reloaders (nodemon, uvicorn --reload, pm2) immediately respawn a new server.
      const finalCheck = await this.scanner.scanPort(port);
      let message = `Successfully freed port ${port} (stopped ${processName}, PID ${pid}).`;
      if (finalCheck && finalCheck.pid === pid) {
        message = `Couldn't free port ${port}: ${processName} refused to stop. It may be running as administrator/root.`;
      } else if (finalCheck) {
        message =
          `Port ${port} was freed, but a new server grabbed it right away (PID ${finalCheck.pid}). ` +
          `An auto-restarter (nodemon, --reload, pm2, or a "dev" script) is probably still running — stop it in its terminal.`;
      }

      return {
        success: !finalCheck,
        port,
        pid,
        processName,
        message,
        graceful,
      };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        port,
        pid,
        processName,
        message:
          code === 'EPERM'
            ? `EnvWizard doesn't have permission to stop ${processName} on port ${port} (it may belong to another user or run as root).`
            : `Couldn't stop ${processName} on port ${port}: ${errorMessage}`,
        graceful: false,
      };
    }
  }
}
