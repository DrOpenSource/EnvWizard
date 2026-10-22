import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as net from 'node:net';
import {
  TerminalJamDetector,
  detectJam,
  inferPortFromCommand,
  stripAnsi,
} from '../src/core/TerminalJamDetector.js';

describe('detectJam', () => {
  // Each fixture is the exact line the tool prints when its port is taken.
  const fixtures: [string, string, { kind: string; port?: number; newPort?: number; tool: string }][] = [
    ['Node.js', 'Error: listen EADDRINUSE: address already in use :::3000', { kind: 'blocked', port: 3000, tool: 'Node.js' }],
    ['Node.js IPv4', 'Error: listen EADDRINUSE: address already in use 127.0.0.1:4000', { kind: 'blocked', port: 4000, tool: 'Node.js' }],
    ['Next.js', ' ⚠ Port 3000 is in use, trying 3001 instead.', { kind: 'shifted', port: 3000, newPort: 3001, tool: 'Next.js' }],
    ['Vite', 'Port 5173 is in use, trying another one...', { kind: 'shifted', port: 5173, tool: 'Vite' }],
    ['CRA', 'Something is already running on port 3000.', { kind: 'blocked', port: 3000, tool: 'Create React App' }],
    [
      'Uvicorn (Linux)',
      "ERROR:    [Errno 98] error while attempting to bind on address ('127.0.0.1', 8000): address already in use",
      { kind: 'blocked', port: 8000, tool: 'Python' },
    ],
    [
      'Uvicorn (Windows)',
      "ERROR:    [WinError 10048] error while attempting to bind on address ('0.0.0.0', 8001): only one usage of each socket address",
      { kind: 'blocked', port: 8001, tool: 'Python' },
    ],
    ['Flask', 'Port 5000 is in use by another program. Either identify and stop that program, or start the server with a different port.', { kind: 'blocked', port: 5000, tool: 'Flask' }],
    ['Django', 'Error: That port is already in use.', { kind: 'blocked', tool: 'Django' }],
    ['Rails', 'Address already in use - bind(2) for "127.0.0.1" port 3000 (Errno::EADDRINUSE)', { kind: 'blocked', port: 3000, tool: 'Ruby' }],
    ['Bun', 'error: Failed to start server. Is port 3000 in use?', { kind: 'blocked', port: 3000, tool: 'Bun' }],
    ['Go', 'listen tcp :8080: bind: address already in use', { kind: 'blocked', port: 8080, tool: 'Go' }],
  ];

  it.each(fixtures)('recognizes %s', (_name, line, expected) => {
    expect(detectJam(line)).toMatchObject(expected);
  });

  it('flags WinError 10013 as possibly a Windows reserved port', () => {
    const jam = detectJam('PermissionError: [WinError 10013] An attempt was made to access a socket in a way forbidden by its access permissions');
    expect(jam).toMatchObject({ kind: 'blocked', tool: 'Windows', mayBeWindowsReserved: true });
  });

  it('ignores ordinary output', () => {
    expect(detectJam('  VITE v5.4.0  ready in 312 ms\n  ➜  Local:   http://localhost:5173/')).toBeUndefined();
    expect(detectJam('Compiled successfully. Port 3000 is your app.')).toBeUndefined();
  });
});

describe('TerminalJamDetector (streamed output)', () => {
  it('detects a message split across chunks and wrapped in ANSI colors', () => {
    const detector = new TerminalJamDetector('npm run dev');
    expect(detector.feed('\x1b[31mError: listen EADDR')).toBeUndefined();
    expect(detector.feed('INUSE: address already in use :::30')).toBeUndefined();
    expect(detector.feed('00\x1b[39m\r\n    at Server.setupListenHandle')).toMatchObject({ port: 3000, tool: 'Node.js' });
  });

  it('reports only once per command', () => {
    const detector = new TerminalJamDetector();
    expect(detector.feed('Error: listen EADDRINUSE: address already in use :::3000\n')).toBeDefined();
    expect(detector.feed('Error: listen EADDRINUSE: address already in use :::3000\n')).toBeUndefined();
  });

  it('checks a final line without a trailing newline on flush', () => {
    const detector = new TerminalJamDetector();
    expect(detector.feed('Error: That port is already in use.')).toBeUndefined();
    expect(detector.flush()).toMatchObject({ tool: 'Django' });
  });

  it('infers the port from the command when the message has none', () => {
    const detector = new TerminalJamDetector('python manage.py runserver 8080');
    expect(detector.feed('Error: That port is already in use.\n')?.port).toBe(8080);
  });

  it('strips VS Code shell-integration OSC sequences', () => {
    expect(stripAnsi('\x1b]633;C\x07Port 5173 is in use, trying another one...')).toBe('Port 5173 is in use, trying another one...');
  });

  it('recognizes the real error a Node server prints on this machine', async () => {
    const blocker = net.createServer();
    const port = await new Promise<number>((resolve) => blocker.listen(0, () => resolve((blocker.address() as net.AddressInfo).port)));
    try {
      const run = spawnSync(process.execPath, ['-e', `require('http').createServer().listen(${port})`], { encoding: 'utf8', timeout: 10000 });
      const detector = new TerminalJamDetector();
      const jam = detector.feed(run.stderr) ?? detector.flush();
      expect(jam).toMatchObject({ kind: 'blocked', port, tool: 'Node.js' });
    } finally {
      blocker.close();
    }
  });
});

describe('inferPortFromCommand', () => {
  it.each([
    ['uvicorn main:app --reload --port 8001', 8001],
    ['next dev -p 4000', 4000],
    ['PORT=3005 node server.js', 3005],
    ['python manage.py runserver 0.0.0.0:9000', 9000],
    ['python manage.py runserver', 8000],
    ['uvicorn main:app', 8000],
    ['flask run', 5000],
    ['python -m http.server 8080', 8080],
    ['npm run dev', undefined],
  ])('%s -> %s', (cmd, port) => {
    expect(inferPortFromCommand(cmd)).toBe(port);
  });
});
