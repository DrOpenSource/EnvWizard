import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { ProcessDetails } from '../shared/types.js';

const execAsync = promisify(exec);

export class ProcessInspector {
  private platform: NodeJS.Platform;

  constructor(platformOverride?: NodeJS.Platform) {
    this.platform = platformOverride || os.platform();
  }

  /**
   * Retrieves process details for a specific PID.
   */
  async inspectProcess(pid: number): Promise<ProcessDetails> {
    if (pid <= 0) {
      return { pid, name: 'System Idle' };
    }

    try {
      if (this.platform === 'win32') {
        return await this.inspectWindowsProcess(pid);
      } else {
        return await this.inspectUnixProcess(pid);
      }
    } catch {
      return {
        pid,
        name: 'Unknown Process',
      };
    }
  }

  private async inspectWindowsProcess(pid: number): Promise<ProcessDetails> {
    // Note: Windows does not expose another process's working directory without native code,
    // so `cwd` is left empty here; the command line usually reveals the project instead.
    try {
      const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\" | Select-Object -Property Name,CommandLine,ParentProcessId | ConvertTo-Json"`;
      const { stdout } = await execAsync(psCommand, { timeout: 5000 });
      const parsed = JSON.parse(stdout.trim());

      return {
        pid,
        name: parsed.Name || 'Unknown',
        commandLine: parsed.CommandLine || undefined,
        parentPid: parsed.ParentProcessId || undefined,
      };
    } catch {
      // Fallback to tasklist
      try {
        const { stdout } = await execAsync(`tasklist /fi "PID eq ${pid}" /fo csv /nh`, { timeout: 2000 });
        const line = stdout.trim();
        // When the PID is gone tasklist prints "INFO: No tasks are running..." instead of a CSV row
        if (line.startsWith('"')) {
          return { pid, name: line.split(',')[0].replace(/"/g, '').trim() };
        }
      } catch {
        // Fallback
      }

      return { pid, name: 'Unknown Process' };
    }
  }

  private async inspectUnixProcess(pid: number): Promise<ProcessDetails> {
    try {
      // Query comm and args separately: on macOS comm is a full path that may contain spaces
      // (e.g. "/Applications/Visual Studio Code.app/.../Code Helper (Plugin)").
      const [{ stdout: comm }, { stdout: args }] = await Promise.all([
        execAsync(`ps -p ${pid} -o comm=`, { timeout: 2000 }),
        execAsync(`ps -p ${pid} -o args=`, { timeout: 2000 }),
      ]);
      const fullName = comm.trim();
      const name = fullName.split('/').pop() || fullName;

      return {
        pid,
        name: name || 'Unix Process',
        commandLine: args.trim() || undefined,
        cwd: await this.resolveUnixCwd(pid),
      };
    } catch {
      return { pid, name: 'Unix Process' };
    }
  }

  private async resolveUnixCwd(pid: number): Promise<string | undefined> {
    try {
      if (this.platform === 'linux') {
        return fs.readlinkSync(`/proc/${pid}/cwd`);
      }
      const { stdout } = await execAsync(`lsof -a -p ${pid} -d cwd -Fn`, { timeout: 2000 });
      const line = stdout.split('\n').find((l) => l.startsWith('n'));
      return line ? line.substring(1) : undefined;
    } catch {
      return undefined;
    }
  }
}
