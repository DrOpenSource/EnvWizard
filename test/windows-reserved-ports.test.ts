import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseExcludedPortRanges,
  findMatchingReservedRange,
  formatWindowsReservedExplanation,
  getWindowsReservedPortRanges,
  checkWindowsReservedPort,
  clearReservedPortsCache,
} from '../src/core/WindowsReservedPorts.js';

const SAMPLE_NETSH_OUTPUT = `
Protocol tcp Port Exclusion Ranges

Start Port    End Port      
----------    --------      
      5357        5357      
      8000        8005      
     50000       50059     *

* - Administered port exclusions.
`;

describe('WindowsReservedPorts', () => {
  beforeEach(() => {
    clearReservedPortsCache();
  });

  describe('parseExcludedPortRanges', () => {
    it('parses valid netsh port range tables correctly', () => {
      const ranges = parseExcludedPortRanges(SAMPLE_NETSH_OUTPUT);
      expect(ranges).toEqual([
        { start: 5357, end: 5357 },
        { start: 8000, end: 8005 },
        { start: 50000, end: 50059 },
      ]);
    });

    it('returns empty array on blank or invalid output', () => {
      expect(parseExcludedPortRanges('')).toEqual([]);
      expect(parseExcludedPortRanges('Some error occurred\nAccess denied')).toEqual([]);
    });
  });

  describe('findMatchingReservedRange', () => {
    const ranges = [
      { start: 5357, end: 5357 },
      { start: 8000, end: 8005 },
      { start: 50000, end: 50059 },
    ];

    it('identifies exact single port match', () => {
      expect(findMatchingReservedRange(5357, ranges)).toEqual({ start: 5357, end: 5357 });
    });

    it('identifies port within range boundaries', () => {
      expect(findMatchingReservedRange(8000, ranges)).toEqual({ start: 8000, end: 8005 });
      expect(findMatchingReservedRange(8003, ranges)).toEqual({ start: 8000, end: 8005 });
      expect(findMatchingReservedRange(8005, ranges)).toEqual({ start: 8000, end: 8005 });
    });

    it('returns undefined when port is not in any range', () => {
      expect(findMatchingReservedRange(3000, ranges)).toBeUndefined();
      expect(findMatchingReservedRange(8006, ranges)).toBeUndefined();
      expect(findMatchingReservedRange(49999, ranges)).toBeUndefined();
    });

    it('returns undefined for invalid port numbers', () => {
      expect(findMatchingReservedRange(-1, ranges)).toBeUndefined();
      expect(findMatchingReservedRange(70000, ranges)).toBeUndefined();
    });
  });

  describe('formatWindowsReservedExplanation', () => {
    it('formats a multi-port range message with plain English instructions', () => {
      const msg = formatWindowsReservedExplanation(8002, { start: 8000, end: 8005 });
      expect(msg).toContain('Windows has reserved ports 8000–8005 for Hyper-V/WSL/Docker');
      expect(msg).toContain('net stop winnat');
      expect(msg).toContain('net start winnat');
    });

    it('formats a single port range message', () => {
      const msg = formatWindowsReservedExplanation(5357, { start: 5357, end: 5357 });
      expect(msg).toContain('Windows has reserved ports 5357–5357 for Hyper-V/WSL/Docker');
    });
  });

  describe('getWindowsReservedPortRanges & checkWindowsReservedPort', () => {
    it('returns empty array on non-Windows platforms', async () => {
      const ranges = await getWindowsReservedPortRanges(async () => ({ stdout: SAMPLE_NETSH_OUTPUT }), 'linux');
      expect(ranges).toEqual([]);

      const result = await checkWindowsReservedPort(8002, async () => ({ stdout: SAMPLE_NETSH_OUTPUT }), 'linux');
      expect(result.isReserved).toBe(false);
    });

    it('invokes custom runner and detects reserved port on win32', async () => {
      const result = await checkWindowsReservedPort(
        8002,
        async () => ({ stdout: SAMPLE_NETSH_OUTPUT }),
        'win32'
      );
      expect(result.isReserved).toBe(true);
      expect(result.range).toEqual({ start: 8000, end: 8005 });
      expect(result.message).toContain('Hyper-V/WSL/Docker');
    });

    it('returns not reserved when port is unreserved on win32', async () => {
      const result = await checkWindowsReservedPort(
        3000,
        async () => ({ stdout: SAMPLE_NETSH_OUTPUT }),
        'win32'
      );
      expect(result.isReserved).toBe(false);
      expect(result.range).toBeUndefined();
      expect(result.message).toBeUndefined();
    });

    it('gracefully handles runner failures without throwing', async () => {
      const result = await checkWindowsReservedPort(
        8000,
        async () => {
          throw new Error('Command failed');
        },
        'win32'
      );
      expect(result.isReserved).toBe(false);
    });
  });
});
