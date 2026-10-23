import { describe, it, expect, vi } from 'vitest';
import {
  findOwningTerminal,
  sendCtrlCToTerminal,
  waitForPortFree,
  politeUnjamPort,
} from '../src/extension/terminalShutdown.js';
import { PortScanner } from '../src/core/PortScanner.js';
import { ProcessInspector } from '../src/core/ProcessInspector.js';
import { ProcessTerminator, SafetyShieldError } from '../src/core/ProcessTerminator.js';
import { ProcessDetailsCache, PortServices } from '../src/extension/actions.js';
import type * as vscode from 'vscode';

function createMockTerminal(processId: number | undefined): vscode.Terminal {
  return {
    name: 'Mock Terminal',
    processId: Promise.resolve(processId),
    sendText: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    creationOptions: {},
    exitStatus: undefined,
    state: { isInteractedWith: true },
  } as unknown as vscode.Terminal;
}

describe('terminalShutdown', () => {
  describe('findOwningTerminal', () => {
    it('finds terminal by exact processId', async () => {
      const term1 = createMockTerminal(1001);
      const term2 = createMockTerminal(1002);

      const found = await findOwningTerminal(1002, [], [term1, term2]);
      expect(found).toBe(term2);
    });

    it('finds terminal by ancestor PID in process hierarchy', async () => {
      const term1 = createMockTerminal(1001);
      const term2 = createMockTerminal(1002);

      // Process 5555 has ancestors [3333, 1001]
      const found = await findOwningTerminal(5555, [3333, 1001], [term1, term2]);
      expect(found).toBe(term1);
    });

    it('returns undefined when no terminal matches', async () => {
      const term1 = createMockTerminal(1001);
      const found = await findOwningTerminal(9999, [8888], [term1]);
      expect(found).toBeUndefined();
    });
  });

  describe('sendCtrlCToTerminal', () => {
    it('sends \\x03 without appending newline', () => {
      const term = createMockTerminal(1234);
      sendCtrlCToTerminal(term);
      expect(term.sendText).toHaveBeenCalledWith('\x03', false);
    });
  });

  describe('waitForPortFree', () => {
    it('resolves true once port scanner reports port is free', async () => {
      let checks = 0;
      const scanner = {
        scanPort: vi.fn().mockImplementation(async () => {
          checks++;
          return checks >= 2 ? undefined : { port: 3000, pid: 1234 };
        }),
      } as unknown as PortScanner;

      const freed = await waitForPortFree(3000, scanner, 500, 20);
      expect(freed).toBe(true);
      expect(checks).toBeGreaterThanOrEqual(2);
    });

    it('resolves false if port remains occupied until timeout', async () => {
      const scanner = {
        scanPort: vi.fn().mockResolvedValue({ port: 3000, pid: 1234 }),
      } as unknown as PortScanner;

      const freed = await waitForPortFree(3000, scanner, 60, 20);
      expect(freed).toBe(false);
    });
  });

  describe('politeUnjamPort', () => {
    it('returns success if port is already free', async () => {
      const scanner = {
        scanPort: vi.fn().mockResolvedValue(undefined),
      } as unknown as PortScanner;
      const inspector = new ProcessInspector();
      const terminator = new ProcessTerminator();
      const services: PortServices = {
        scanner,
        inspector,
        terminator,
        cache: new ProcessDetailsCache(inspector),
      };

      const res = await politeUnjamPort(3000, services);
      expect(res.success).toBe(true);
      expect(res.message).toContain('already free');
    });

    it('throws SafetyShieldError if port is held by a protected process', async () => {
      const scanner = {
        scanPort: vi.fn().mockResolvedValue({ port: 3000, pid: 100 }),
      } as unknown as PortScanner;
      const inspector = {
        inspectProcess: vi.fn().mockResolvedValue({ pid: 100, name: 'code' }),
      } as unknown as ProcessInspector;
      const terminator = new ProcessTerminator();
      const services: PortServices = {
        scanner,
        inspector,
        terminator,
        cache: new ProcessDetailsCache(inspector),
      };

      await expect(politeUnjamPort(3000, services)).rejects.toThrow(SafetyShieldError);
    });

    it('frees port politely via Ctrl+C if terminal owns the process', async () => {
      const term = createMockTerminal(500);
      let scanCount = 0;
      const scanner = {
        scanPort: vi.fn().mockImplementation(async () => {
          scanCount++;
          // First scan returns busy; subsequent scans after Ctrl+C return free
          return scanCount === 1 ? { port: 3000, pid: 500 } : undefined;
        }),
      } as unknown as PortScanner;
      const inspector = {
        inspectProcess: vi.fn().mockResolvedValue({ pid: 500, name: 'node' }),
      } as unknown as ProcessInspector;
      const terminator = {
        isProtected: () => false,
        unjamPort: vi.fn(),
      } as unknown as ProcessTerminator;

      const services: PortServices = {
        scanner,
        inspector,
        terminator,
        cache: new ProcessDetailsCache(inspector),
      };

      const res = await politeUnjamPort(3000, services, {
        targetTerminal: term,
        timeoutMs: 300,
        checkIntervalMs: 20,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('terminal Ctrl+C');
      expect(term.sendText).toHaveBeenCalledWith('\x03', false);
      expect(terminator.unjamPort).not.toHaveBeenCalled();
    });

    it('falls back to terminator.unjamPort if terminal Ctrl+C does not release port within timeout', async () => {
      const term = createMockTerminal(500);
      const scanner = {
        scanPort: vi.fn().mockResolvedValue({ port: 3000, pid: 500 }),
      } as unknown as PortScanner;
      const inspector = {
        inspectProcess: vi.fn().mockResolvedValue({ pid: 500, name: 'node' }),
      } as unknown as ProcessInspector;
      const terminator = {
        isProtected: () => false,
        unjamPort: vi.fn().mockResolvedValue({
          success: true,
          port: 3000,
          pid: 500,
          message: 'Force killed via fallback',
          graceful: false,
        }),
      } as unknown as ProcessTerminator;

      const services: PortServices = {
        scanner,
        inspector,
        terminator,
        cache: new ProcessDetailsCache(inspector),
      };

      const res = await politeUnjamPort(3000, services, {
        targetTerminal: term,
        timeoutMs: 60,
        checkIntervalMs: 20,
      });

      expect(res.success).toBe(true);
      expect(terminator.unjamPort).toHaveBeenCalledWith(3000);
    });
  });
});
