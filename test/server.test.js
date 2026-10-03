import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

async function unusedPort() {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

function startProcess(t, overrides = {}) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PUBLIC_DOMAIN: '',
    RENDER_EXTERNAL_HOSTNAME: 'fecci-fusion-mcp.onrender.com',
    ALLOWED_HOSTS: '',
    ALLOWED_ORIGINS: '',
    ...overrides,
  };
  delete env.HOST; // Exercita o default 0.0.0.0 usado pela entrada real do servidor.
  const child = spawn(process.execPath, ['server.js'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    const timeout = setTimeout(() => child.kill('SIGKILL'), 2_000);
    timeout.unref();
    child.kill('SIGTERM');
    await exited;
    clearTimeout(timeout);
  });
  return { child, stdout: () => stdout, stderr: () => stderr };
}

function waitUntilReady(process) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Servidor não ficou pronto: ' + process.stderr())), 8_000);
    timeout.unref();
    const onData = () => {
      if (process.stdout().includes('MCP escutando em')) finish();
    };
    const onExit = () => finish(new Error('Servidor encerrou antes de ficar pronto: ' + process.stderr()));
    function finish(error) {
      clearTimeout(timeout);
      process.child.stdout.off('data', onData);
      process.child.off('exit', onExit);
      process.child.off('error', finish);
      if (error) reject(error);
      else resolve();
    }
    process.child.stdout.on('data', onData);
    process.child.once('exit', onExit);
    process.child.once('error', finish);
    onData();
  });
}

test('entrada real usa PORT da hospedagem, escuta em 0.0.0.0 e encerra com SIGTERM', { timeout: 12_000 }, async (t) => {
  const port = await unusedPort();
  const process = startProcess(t, { PORT: String(port) });
  await waitUntilReady(process);
  assert.match(process.stdout(), new RegExp(`http://0\\.0\\.0\\.0:${port}/mcp`));

  // Outro endereço do bloco loopback comprova que não foi feito bind apenas em 127.0.0.1.
  const response = await new Promise((resolve, reject) => {
    const req = request(`http://127.0.0.2:${port}/health`, {
      headers: { Host: 'fecci-fusion-mcp.onrender.com' },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.once('error', reject);
      res.once('end', () => resolve({ status: res.statusCode, body }));
    });
    req.once('error', reject);
    req.end();
  });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
  const exited = once(process.child, 'exit');
  process.child.kill('SIGTERM');
  const [code, signal] = await exited;
  assert.equal(code, 0);
  assert.equal(signal, null);
  assert.equal(process.stderr(), '');
});

test('produção sem domínio permitido falha antes de abrir a porta', { timeout: 8_000 }, async (t) => {
  const process = startProcess(t, {
    PORT: String(await unusedPort()),
    RENDER_EXTERNAL_HOSTNAME: '',
  });
  const [code] = await once(process.child, 'exit');
  assert.equal(code, 1);
  assert.match(process.stderr(), /PUBLIC_DOMAIN, RENDER_EXTERNAL_HOSTNAME ou ALLOWED_HOSTS/);
  assert.doesNotMatch(process.stdout(), /MCP escutando em/);
});
