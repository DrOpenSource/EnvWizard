import { describe, it, expect } from 'vitest';
import {
  normalizePathForComparison,
  isPathInside,
  isSystemPath,
  extractCandidatePaths,
  resolveProcessAncestors,
  classifyOwnership,
  classify,
  parseParentTable,
} from '../src/core/ProcessOwnership.js';
import { ProcessDetails } from '../src/shared/types.js';

describe('ProcessOwnership', () => {
  describe('Path Utilities', () => {
    it('normalizes paths across platforms', () => {
      expect(normalizePathForComparison('C:\\Users\\User\\Project\\', 'win32')).toBe('c:/users/user/project');
      expect(normalizePathForComparison('/home/user/project/', 'linux')).toBe('/home/user/project');
    });

    it('determines if a path is inside a parent folder correctly', () => {
      // Windows case insensitivity & slash variance
      expect(isPathInside('C:\\Users\\User\\Project\\src\\index.ts', 'c:/users/user/project', 'win32')).toBe(true);
      expect(isPathInside('c:/users/user/project', 'C:\\Users\\User\\Project', 'win32')).toBe(true);
      expect(isPathInside('C:\\Users\\User\\OtherProject\\index.ts', 'c:/users/user/project', 'win32')).toBe(false);

      // Prevents prefix confusion: "project-2" must not match "project"
      expect(isPathInside('/home/user/project-2/server.js', '/home/user/project', 'linux')).toBe(false);
      expect(isPathInside('/home/user/project/server.js', '/home/user/project', 'linux')).toBe(true);
    });

    it('identifies system and root paths', () => {
      expect(isSystemPath('C:\\Windows\\System32\\svchost.exe', 'win32')).toBe(true);
      expect(isSystemPath('C:\\Program Files\\nodejs\\node.exe', 'win32')).toBe(true);
      expect(isSystemPath('C:\\', 'win32')).toBe(true);
      expect(isSystemPath('C:\\Users\\User\\Projects\\app', 'win32')).toBe(false);

      expect(isSystemPath('/usr/bin/node', 'linux')).toBe(true);
      expect(isSystemPath('/etc/nginx', 'linux')).toBe(true);
      expect(isSystemPath('/', 'linux')).toBe(true);
      expect(isSystemPath('/home/user/my-app', 'linux')).toBe(false);
    });

    it('extracts candidate paths from command lines', () => {
      const winCmd = '"C:\\Program Files\\nodejs\\node.exe" "C:\\Work\\App\\server.js" --port 3000';
      const extractedWin = extractCandidatePaths(winCmd, 'win32');
      expect(extractedWin).toContain('C:\\Work\\App\\server.js');

      const unixCmd = 'python3 /home/user/dev/api/main.py --workers 4';
      const extractedUnix = extractCandidatePaths(unixCmd, 'linux');
      expect(extractedUnix).toContain('/home/user/dev/api/main.py');
    });
  });

  describe('resolveProcessAncestors', () => {
    it('walks up the parent chain until max depth or stopAtPids', async () => {
      // Tree: 5000 -> 4000 -> 3000 -> 2000 -> 1
      const parentMap = new Map<number, number>([
        [5000, 4000],
        [4000, 3000],
        [3000, 2000],
        [2000, 1],
      ]);
      const mockGetParent = async (p: number) => parentMap.get(p);

      const ancestors = await resolveProcessAncestors(5000, {
        getParentPid: mockGetParent,
      });
      expect(ancestors).toEqual([4000, 3000, 2000, 1]);

      // Early stop at specific PID
      const stoppedAncestors = await resolveProcessAncestors(5000, {
        getParentPid: mockGetParent,
        stopAtPids: new Set([3000]),
      });
      expect(stoppedAncestors).toEqual([4000, 3000]);
    });

    it('guards against cycles and invalid parent PIDs', async () => {
      // Cycle: 100 -> 100
      const mockCycle = async () => 100;
      const ancestors = await resolveProcessAncestors(100, { getParentPid: mockCycle });
      expect(ancestors).toEqual([]);
    });
  });

  describe('classifyOwnership', () => {
    const workspaceFoldersWin = ['C:\\Projects\\EnvWizard'];
    const workspaceFoldersUnix = ['/home/user/EnvWizard'];

    it('identifies this-terminal when direct PID is a terminal shell', () => {
      const details: ProcessDetails = { pid: 1234, name: 'bash' };
      const res = classifyOwnership(details, workspaceFoldersUnix, [1234], [], 'linux');
      expect(res).toBe('this-terminal');
    });

    it('identifies this-terminal when parentPid is a terminal shell', () => {
      const details: ProcessDetails = { pid: 5678, name: 'node', parentPid: 1234 };
      const res = classifyOwnership(details, workspaceFoldersUnix, [1234], [], 'linux');
      expect(res).toBe('this-terminal');
    });

    it('identifies this-terminal when an ancestor PID matches a terminal shell', () => {
      const details: ProcessDetails = { pid: 9999, name: 'node', parentPid: 8888 };
      const res = classifyOwnership(details, workspaceFoldersUnix, [1234], [8888, 1234], 'linux');
      expect(res).toBe('this-terminal');
    });

    it('identifies this-project when cwd is inside workspace', () => {
      const details: ProcessDetails = {
        pid: 3456,
        name: 'node',
        cwd: '/home/user/EnvWizard/apps/web',
      };
      const res = classifyOwnership(details, workspaceFoldersUnix, [], [], 'linux');
      expect(res).toBe('this-project');
    });

    it('identifies this-project on Windows when command line references workspace', () => {
      const details: ProcessDetails = {
        pid: 3456,
        name: 'node',
        commandLine: 'node "C:\\Projects\\EnvWizard\\dist\\server.js"',
      };
      const res = classifyOwnership(details, workspaceFoldersWin, [], [], 'win32');
      expect(res).toBe('this-project');
    });

    it('identifies other-project when cwd is in another user project', () => {
      const details: ProcessDetails = {
        pid: 7777,
        name: 'python',
        cwd: '/home/user/OtherApp',
      };
      const res = classifyOwnership(details, workspaceFoldersUnix, [], [], 'linux');
      expect(res).toBe('other-project');
    });

    it('identifies other-project on Windows when command line points to another project', () => {
      const details: ProcessDetails = {
        pid: 7777,
        name: 'python',
        commandLine: 'python "D:\\Work\\OtherApp\\manage.py" runserver',
      };
      const res = classifyOwnership(details, workspaceFoldersWin, [], [], 'win32');
      expect(res).toBe('other-project');
    });

    it('returns unknown when only generic command line is present without paths or cwd', () => {
      const details: ProcessDetails = {
        pid: 8888,
        name: 'python',
        commandLine: 'python -m http.server 8000',
      };
      const res = classifyOwnership(details, workspaceFoldersUnix, [], [], 'linux');
      expect(res).toBe('unknown');
    });

    it('does not classify system processes as other-project', () => {
      const details: ProcessDetails = {
        pid: 1111,
        name: 'svchost',
        commandLine: 'C:\\Windows\\System32\\svchost.exe -k netsvcs',
        cwd: 'C:\\Windows\\System32',
      };
      const res = classifyOwnership(details, workspaceFoldersWin, [], [], 'win32');
      expect(res).toBe('unknown');
    });
  });

  describe('classify (async with automatic ancestor resolution)', () => {
    it('resolves ancestors automatically when terminal shell is in the hierarchy', async () => {
      const parentMap = new Map<number, number>([
        [7000, 6000],
        [6000, 5000], // terminal PID
      ]);
      const details: ProcessDetails = { pid: 7000, name: 'node' };

      const res = await classify(details, ['/home/user/test'], [5000], {
        getParentPid: async (p) => parentMap.get(p),
        platform: 'linux',
      });
      expect(res).toBe('this-terminal');
    });
  });

  describe('parent PID lookup', () => {
    it('parses a "pid ppid" process table', () => {
      const table = parseParentTable('4 0\r\n  1234 4\r\n\r\nnoise\r\n5678 1234\r\n');
      expect(table.get(1234)).toBe(4);
      expect(table.get(5678)).toBe(1234);
      expect(table.size).toBe(3);
    });

    it('walks the real parent chain of this test process', async () => {
      const ancestors = await resolveProcessAncestors(process.pid);
      expect(ancestors[0]).toBe(process.ppid);
    });
  });
});

describe('isPathInside with differently spelled real paths', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const os = require('node:os') as typeof import('node:os');
  const path = require('node:path') as typeof import('node:path');
  const { execSync } = require('node:child_process') as typeof import('node:child_process');

  it('matches a folder reached through a junction / symlink', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'envwizard-link-'));
    try {
      const real = path.join(tmp, 'project');
      fs.mkdirSync(path.join(real, 'src'), { recursive: true });
      const link = path.join(tmp, 'link');
      fs.symlinkSync(real, link, 'junction');
      expect(isPathInside(path.join(link, 'src'), real)).toBe(true);
      expect(isPathInside(path.join(real, 'src', 'not-yet-created.js'), link)).toBe(true);
      expect(isPathInside(path.join(tmp, 'elsewhere'), link)).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it.runIf(process.platform === 'win32')('matches Windows 8.3 short names (RUNNER~1 vs runneradmin)', (ctx) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'envwizard-short-'));
    try {
      const long = path.join(tmp, 'a very long project folder name');
      fs.mkdirSync(long);
      const short = execSync(`cmd /c for %I in ("${long}") do @echo %~sI`, { encoding: 'utf8' }).trim();
      if (short.toLowerCase() === long.toLowerCase()) {
        ctx.skip(); // 8.3 names are turned off on this volume
        return;
      }
      expect(isPathInside(long, short)).toBe(true);
      expect(isPathInside(short, long)).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
