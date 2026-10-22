// Runs inside the VS Code extension host. Plain CommonJS, so no build step is needed.
const assert = require('node:assert/strict');
const http = require('node:http');
const vscode = require('vscode');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${what}`)), ms))),
  ]).finally(() => clearTimeout(timer));
}

test('activates and registers all commands', async () => {
  const ext = vscode.extensions.getExtension('dr-opensource.envwizard');
  assert.ok(ext, 'extension not found');
  await ext.activate();
  assert.equal(ext.isActive, true);

  const commands = await vscode.commands.getCommands(true);
  for (const id of ['scanPorts', 'unjamPort', 'cleanSlate', 'auditEnv', 'activateLicense', 'buyLicense']) {
    assert.ok(commands.includes(`envwizard.${id}`), `missing command envwizard.${id}`);
  }
});

test('opens the Dev Deck without errors', async () => {
  await vscode.commands.executeCommand('workbench.view.extension.envwizard-deck');
});

// v0.2 depends on this: EnvWizard must be able to read the output of a command the user
// runs in the integrated terminal and see the "port in use" error (shell integration API).
test('terminal shell integration exposes a port-in-use error from a user command', async () => {
  const port = 39871;
  const blocker = http.createServer().listen(port);
  const terminal = vscode.window.createTerminal({ name: 'EnvWizard jam test' });

  try {
    terminal.show();
    const shellIntegration =
      terminal.shellIntegration ||
      (await withTimeout(
        new Promise((resolve) => {
          const sub = vscode.window.onDidChangeTerminalShellIntegration((e) => {
            if (e.terminal === terminal) {
              sub.dispose();
              resolve(e.shellIntegration);
            }
          });
        }),
        20000,
        'shell integration did not activate'
      ));

    // Listen the way the feature will: passively, for any command started in the terminal
    const output = new Promise((resolve) => {
      const sub = vscode.window.onDidStartTerminalShellExecution(async (e) => {
        if (e.terminal !== terminal) return;
        sub.dispose();
        let text = '';
        for await (const chunk of e.execution.read()) text += chunk;
        resolve({ text, commandLine: e.execution.commandLine.value });
      });
    });

    shellIntegration.executeCommand(`node -e "require('http').createServer().listen(${port})"`);
    const result = await withTimeout(output, 30000, 'terminal command output');

    assert.match(result.text, new RegExp(`EADDRINUSE[^\\n]*${port}`), `no EADDRINUSE in output:\n${result.text}`);
    assert.match(result.commandLine, /listen/);
  } finally {
    terminal.dispose();
    blocker.close();
  }
});

exports.run = async function run() {
  const failures = [];
  for (const { name, fn } of tests) {
    const started = Date.now();
    try {
      await fn();
      console.log(`  ✓ ${name} (${Date.now() - started}ms)`);
    } catch (err) {
      console.log(`  ✗ ${name}\n    ${(err && err.stack) || err}`);
      failures.push(name);
    }
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} integration test(s) failed`);
  }
};
