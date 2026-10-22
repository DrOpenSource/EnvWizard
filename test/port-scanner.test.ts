import { describe, it, expect } from 'vitest';
import * as net from 'node:net';
import { PortScanner } from '../src/core/PortScanner.js';

describe('PortScanner', () => {
  it('correctly parses Windows netstat output', () => {
    const scanner = new PortScanner('win32');
    const mockNetstat = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1048
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       14220
  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       8412
  TCP    192.168.1.15:52000     140.82.112.26:443      ESTABLISHED     21040
  TCP    [::]:8000              [::]:0                 LISTENING       9912
`;

    const ports = scanner.parseWindowsNetstat(mockNetstat);

    expect(ports).toHaveLength(4);
    expect(ports).toEqual([
      { port: 135, pid: 1048, protocol: 'TCP', state: 'LISTENING' },
      { port: 3000, pid: 14220, protocol: 'TCP', state: 'LISTENING' },
      { port: 5173, pid: 8412, protocol: 'TCP', state: 'LISTENING' },
      { port: 8000, pid: 9912, protocol: 'TCP', state: 'LISTENING' },
    ]);
  });

  it('correctly parses macOS/Linux lsof output', () => {
    const scanner = new PortScanner('darwin');
    const mockLsof = `
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
launchd       1 root    7u  IPv4 0x7688461719266179      0t0  TCP *:22 (LISTEN)
node      45120 user   23u  IPv6 0x7688461719267123      0t0  TCP *:3000 (LISTEN)
Python    12904 user    5u  IPv4 0x7688461719268888      0t0  TCP 127.0.0.1:8000 (LISTEN)
`;

    const ports = scanner.parseUnixLsof(mockLsof);

    expect(ports).toHaveLength(3);
    expect(ports).toEqual([
      { port: 22, pid: 1, protocol: 'TCP', state: 'LISTENING', processName: 'launchd' },
      { port: 3000, pid: 45120, protocol: 'TCP', state: 'LISTENING', processName: 'node' },
      { port: 8000, pid: 12904, protocol: 'TCP', state: 'LISTENING', processName: 'Python' },
    ]);
  });

  it('correctly parses Linux ss output', () => {
    const scanner = new PortScanner('linux');
    const mockSs = `LISTEN 0      511          *:3000         *:*    users:(("node",pid=14220,fd=19))
LISTEN 0      4096   127.0.0.1:5432    0.0.0.0:*
LISTEN 0      2048   0.0.0.0:8000      0.0.0.0:*    users:(("uvicorn",pid=9001,fd=3),("uvicorn",pid=9002,fd=3))
`;

    expect(scanner.parseLinuxSs(mockSs)).toEqual([
      { port: 3000, pid: 14220, protocol: 'TCP', state: 'LISTENING', processName: 'node' },
      { port: 8000, pid: 9001, protocol: 'TCP', state: 'LISTENING', processName: 'uvicorn' },
    ]);
  });

  it('reports one row per port and process for dual-stack (IPv4 + IPv6) servers', async () => {
    const scanner = new PortScanner();
    const testPort = 39483;
    const v4 = net.createServer().listen(testPort, '0.0.0.0');
    const v6 = net.createServer().listen(testPort, '::1');
    await new Promise((r) => setTimeout(r, 200));

    try {
      const rows = (await scanner.scanAllOccupied()).filter((p) => p.port === testPort);
      expect(rows).toHaveLength(1);
    } finally {
      await Promise.all([v4, v6].map((s) => new Promise((r) => s.close(() => r(null)))));
    }
  });

  it('detects an actual live TCP server bound on a local port', async () => {
    const scanner = new PortScanner();
    const testPort = 39482;

    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.listen(testPort, '127.0.0.1', () => resolve());
      server.on('error', reject);
    });

    try {
      const portInfo = await scanner.scanPort(testPort);
      expect(portInfo).not.toBeNull();
      expect(portInfo?.port).toBe(testPort);
      expect(portInfo?.pid).toBe(process.pid);
      expect(portInfo?.state).toBe('LISTENING');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // Verify it is now free
    const postClose = await scanner.scanPort(testPort);
    expect(postClose).toBeNull();
  });
});
