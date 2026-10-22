import { describe, it, expect, afterEach } from 'vitest';
import { spawn, execSync, ChildProcess } from 'node:child_process';
import * as net from 'node:net';
import {
  ProcessTerminator,
  SafetyShieldError,
  isDatabaseProcess,
  normalizeProcessName,
} from '../src/core/ProcessTerminator.js';
import { PortScanner } from '../src/core/PortScanner.js';

const spawned: ChildProcess[] = [];

function startNode(code: string): ChildProcess {
  const child = spawn(process.execPath, ['-e', code], { stdio: 'ignore', detached: process.platform !== 'win32' });
  spawned.push(child);
  return child;
}

function killTree(child: ChildProcess) {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    // already gone
  }
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForListener(port: number, timeoutMs = 5000) {
  const scanner = new PortScanner();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await scanner.scanPort(port)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`nothing listened on ${port}`);
}

describe('ProcessTerminator', () => {
  afterEach(() => {
    spawned.splice(0).forEach(killTree);
  });

  it('protects critical operating system and IDE processes', () => {
    const terminator = new ProcessTerminator();

    expect(terminator.isProtected('explorer.exe', 1234)).toBe(true);
    expect(terminator.isProtected('dockerd', 5678)).toBe(true);
    expect(terminator.isProtected('Code.exe', 9101)).toBe(true);
    expect(terminator.isProtected('cursor', 1122)).toBe(true);
    expect(terminator.isProtected('System Idle Process', 0)).toBe(true);
    expect(terminator.isProtected('System', 4)).toBe(true);
    expect(terminator.isProtected('unknown', process.pid)).toBe(true); // Self protection
  });

  it('protects Docker / WSL port relays and macOS IDE helpers', () => {
    const terminator = new ProcessTerminator();

    expect(terminator.isProtected('com.docker.backend.exe', 5000)).toBe(true);
    expect(terminator.isProtected('wslrelay.exe', 5000)).toBe(true);
    expect(terminator.isProtected('vpnkit.exe', 5000)).toBe(true);
    expect(terminator.isProtected('docker-proxy', 5000)).toBe(true);
    expect(terminator.isProtected('Code Helper (Plugin)', 5000)).toBe(true);
    expect(terminator.isProtected('Cursor Helper', 5000)).toBe(true);
    expect(terminator.isProtected('/Applications/Docker.app/Contents/MacOS/com.docker.backend', 5000)).toBe(true);
  });

  it('allows killing ordinary dev server processes', () => {
    const terminator = new ProcessTerminator();

    expect(terminator.isProtected('node.exe', 18400)).toBe(false);
    expect(terminator.isProtected('python', 19200)).toBe(false);
    expect(terminator.isProtected('uvicorn', 15100)).toBe(false);
    expect(terminator.isProtected('bun', 16200)).toBe(false);
    expect(terminator.isProtected('deno', 17300)).toBe(false);
    expect(terminator.isProtected('/usr/local/bin/node', 17300)).toBe(false);
  });

  it('recognizes local databases so Clean Slate can leave them alone', () => {
    expect(isDatabaseProcess('postgres.exe')).toBe(true);
    expect(isDatabaseProcess('redis-server')).toBe(true);
    expect(isDatabaseProcess('/opt/homebrew/bin/mongod')).toBe(true);
    expect(isDatabaseProcess('node')).toBe(false);
    expect(normalizeProcessName('C:\\Program Files\\nodejs\\node.EXE')).toBe('node');
  });

  it('returns success immediately if port is already free', async () => {
    const terminator = new ProcessTerminator();
    const result = await terminator.unjamPort(await freePort());

    expect(result.success).toBe(true);
    expect(result.message).toContain('already free');
  });

  it('throws a SafetyShieldError (not a generic crash) for protected holders', async () => {
    const terminator = new ProcessTerminator();
    const t = terminator as unknown as { scanner: unknown; inspector: unknown };
    t.scanner = { scanPort: async () => ({ port: 1234, pid: 999999, protocol: 'TCP', state: 'LISTENING' }) };
    t.inspector = { inspectProcess: async () => ({ pid: 999999, name: 'wslrelay.exe' }) };

    await expect(terminator.unjamPort(1234)).rejects.toBeInstanceOf(SafetyShieldError);
  });

  it('frees a port held by a real dev server', async () => {
    const port = await freePort();
    startNode(`require('http').createServer().listen(${port})`);
    await waitForListener(port);

    const result = await new ProcessTerminator().unjamPort(port);
    expect(result.success).toBe(true);
    expect(await new PortScanner().scanPort(port)).toBeNull();
  });

  it('frees a port held by a child process (npm run dev -> node)', async () => {
    const port = await freePort();
    startNode(
      `require('child_process').spawn(process.execPath, ['-e', "require('http').createServer().listen(${port})"], { stdio: 'ignore' }); setInterval(() => {}, 1e6);`
    );
    await waitForListener(port);

    const result = await new ProcessTerminator().unjamPort(port);
    expect(result.success).toBe(true);
  });

  it('does not report success when an auto-restarter grabs the port again', async () => {
    const port = await freePort();
    startNode(
      `const { spawn } = require('child_process');
       function go() { spawn(process.execPath, ['-e', "require('http').createServer().listen(${port})"], { stdio: 'ignore' }).on('exit', go); }
       go(); setInterval(() => {}, 1e6);`
    );
    await waitForListener(port);

    const result = await new ProcessTerminator().unjamPort(port);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/auto-restarter/);
  });
});
