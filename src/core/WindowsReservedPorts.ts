import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as os from 'node:os';

const execAsync = promisify(exec);

export interface PortRange {
  start: number;
  end: number;
}

export interface WindowsReservedCheckResult {
  isReserved: boolean;
  range?: PortRange;
  message?: string;
}

/**
 * Parses the table output of `netsh int ipv4 show excludedportrange protocol=tcp`.
 *
 * Example output:
 *   Protocol tcp Port Exclusion Ranges
 *   Start Port    End Port
 *   ----------    --------
 *         5357        5357
 *        50000       50059     *
 *   * - Administered port exclusions.
 */
export function parseExcludedPortRanges(output: string): PortRange[] {
  const ranges: PortRange[] = [];
  const lines = output.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('-') || /^(protocol|start port)/i.test(trimmed)) {
      continue;
    }

    const match = trimmed.match(/^(\d{1,5})\s+(\d{1,5})/);
    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && start > 0 && end >= start && end <= 65535) {
        ranges.push({ start, end });
      }
    }
  }

  return ranges;
}

export function findMatchingReservedRange(port: number, ranges: PortRange[]): PortRange | undefined {
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return undefined;
  }
  return ranges.find((r) => port >= r.start && port <= r.end);
}

export function formatWindowsReservedExplanation(port: number, range?: PortRange): string {
  const rangeDesc = range ? `ports ${range.start}–${range.end}` : `port ${port}`;
  return (
    `Windows has reserved ${rangeDesc} for Hyper-V/WSL/Docker. Nothing to stop. ` +
    `Pick another port, or run "net stop winnat" & "net start winnat" as admin.`
  );
}

// In-memory cache to avoid spawning netsh repeatedly within short intervals.
let cachedRanges: { ranges: PortRange[]; expiresAt: number } | undefined;
const CACHE_TTL_MS = 30_000;

export function clearReservedPortsCache(): void {
  cachedRanges = undefined;
}

/**
 * Retrieves the currently excluded IPv4 TCP port ranges on Windows.
 * On non-Windows platforms, returns an empty array.
 */
export async function getWindowsReservedPortRanges(
  execFn?: (cmd: string) => Promise<{ stdout: string; stderr?: string }>,
  platformOverride?: NodeJS.Platform
): Promise<PortRange[]> {
  const platform = platformOverride || os.platform();
  if (platform !== 'win32') {
    return [];
  }

  const now = Date.now();
  if (cachedRanges && cachedRanges.expiresAt > now) {
    return cachedRanges.ranges;
  }

  try {
    const runner = execFn || ((cmd) => execAsync(cmd, { timeout: 3000 }));
    const { stdout } = await runner('netsh int ipv4 show excludedportrange protocol=tcp');
    const ranges = parseExcludedPortRanges(stdout);
    cachedRanges = { ranges, expiresAt: now + CACHE_TTL_MS };
    return ranges;
  } catch {
    return [];
  }
}

/**
 * Checks whether a given port falls into a Windows reserved/excluded port range.
 */
export async function checkWindowsReservedPort(
  port: number,
  execFn?: (cmd: string) => Promise<{ stdout: string; stderr?: string }>,
  platformOverride?: NodeJS.Platform
): Promise<WindowsReservedCheckResult> {
  const platform = platformOverride || os.platform();
  if (platform !== 'win32') {
    return { isReserved: false };
  }

  const ranges = await getWindowsReservedPortRanges(execFn, platform);
  const matching = findMatchingReservedRange(port, ranges);

  if (matching) {
    return {
      isReserved: true,
      range: matching,
      message: formatWindowsReservedExplanation(port, matching),
    };
  }

  return { isReserved: false };
}
