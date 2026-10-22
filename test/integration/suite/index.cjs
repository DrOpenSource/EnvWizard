// Runs inside the VS Code extension host. Plain CommonJS, so no build step is needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
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

function waitForShellIntegration(terminal) {
  if (terminal.shellIntegration) return Promise.resolve(terminal.shellIntegration);
  return withTimeout(
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
  );
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });
}

async function waitFor(check, ms, what) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out after ${ms}ms: ${what}`);
}

// Sprint 2 gate (F1): a jam in the terminal → toast "Free & Rerun" → the rerun binds the port.
test('terminal jam: Free & Rerun frees the port and the rerun binds it', async () => {
  const port = 39872;
  const { terminalAlerts } = vscode.extensions.getExtension('dr-opensource.envwizard').exports;
  const blocker = spawn('node', ['-e', `require('http').createServer().listen(${port})`], { stdio: 'ignore' });
  const blockerExited = new Promise((resolve) => blocker.once('exit', resolve));
  const terminal = vscode.window.createTerminal({ name: 'EnvWizard rerun test' });
  const alerts = [];
  const originalChoose = terminalAlerts.chooseAction;

  try {
    await waitFor(() => canConnect(port), 10000, 'blocker listening');
    terminal.show();
    const shellIntegration = await waitForShellIntegration(terminal);

    terminalAlerts.chooseAction = async (alert) => {
      alerts.push(alert);
      return 'Free & Rerun';
    };
    const outcome = new Promise((resolve) => {
      const sub = terminalAlerts.onDidHandleJam((o) => (sub.dispose(), resolve(o)));
    });

    shellIntegration.executeCommand(`node -e "require('http').createServer().listen(${port})"`);

    assert.equal(await withTimeout(outcome, 45000, 'jam handled'), 'freed-rerun');
    assert.match(alerts[0].message, new RegExp(`Port ${port} jam`));
    await withTimeout(blockerExited, 10000, 'blocker stopped');
    // The rerun in the terminal now holds the port
    await waitFor(() => canConnect(port), 15000, 'rerun listening');
  } finally {
    terminalAlerts.chooseAction = originalChoose;
    terminal.dispose();
    blocker.kill();
  }
});

// Sprint 3 (F2): an old copy of this project is freed and rerun without a toast. On Windows the
// holder's folder can't be read, so this also proves "this project" is found from its command line.
test('auto-unjam: an old copy of this project is freed and rerun without asking', async () => {
  const port = 39873;
  const ext = vscode.extensions.getExtension('dr-opensource.envwizard');
  const { terminalAlerts } = ext.exports;
  const folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const script = path.join(folder, 'server.js');
  fs.writeFileSync(script, 'require("http").createServer().listen(Number(process.argv[2]));\n');

  const blocker = spawn('node', [script, String(port)], { cwd: folder, stdio: 'ignore' });
  const blockerExited = new Promise((resolve) => blocker.once('exit', resolve));
  const terminal = vscode.window.createTerminal({ name: 'EnvWizard auto test', cwd: folder });
  // A Pro license can't be activated in tests; switch the gate on directly
  const deps = terminalAlerts.deps;
  const originalGate = deps.isAutoUnjamEnabled;
  const originalChoose = terminalAlerts.chooseAction;
  let toastShown = false;

  try {
    deps.isAutoUnjamEnabled = async () => true;
    terminalAlerts.chooseAction = async () => {
      toastShown = true;
      return undefined;
    };
    await waitFor(() => canConnect(port), 10000, 'blocker listening');
    terminal.show();
    const shellIntegration = await waitForShellIntegration(terminal);
    const outcome = new Promise((resolve) => {
      const sub = terminalAlerts.onDidHandleJam((o) => (sub.dispose(), resolve(o)));
    });

    shellIntegration.executeCommand(`node server.js ${port}`);

    assert.equal(await withTimeout(outcome, 45000, 'jam handled'), 'freed-rerun');
    assert.equal(toastShown, false, 'auto-unjam should not ask');
    await withTimeout(blockerExited, 10000, 'blocker stopped');
    await waitFor(() => canConnect(port), 15000, 'rerun listening');
  } finally {
    deps.isAutoUnjamEnabled = originalGate;
    terminalAlerts.chooseAction = originalChoose;
    terminal.dispose();
    blocker.kill();
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
