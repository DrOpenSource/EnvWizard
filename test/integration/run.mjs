// Launches a real VS Code with EnvWizard loaded and runs test/integration/suite.
// Uses a local VS Code when VSCODE_EXECUTABLE is set, otherwise downloads the latest stable.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

// When launched from inside VS Code's own terminal this is inherited and would make Code.exe run as plain Node.
delete process.env.ELECTRON_RUN_AS_NODE;

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'envwizard-it-'));
fs.writeFileSync(path.join(workspace, '.env'), 'API_KEY=\n');
fs.writeFileSync(path.join(workspace, 'index.js'), 'process.env.API_KEY; process.env.MISSING_SECRET;\n');

try {
  await runTests({
    vscodeExecutablePath: process.env.VSCODE_EXECUTABLE || undefined,
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(here, 'suite', 'index.cjs'),
    launchArgs: [
      workspace,
      '--disable-extensions',
      '--user-data-dir', path.join(os.tmpdir(), 'envwizard-it-profile'),
      '--skip-welcome',
      '--skip-release-notes',
    ],
  });
} catch (err) {
  console.error('Integration tests failed:', err);
  process.exitCode = 1;
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}
