import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config.js';

test('configuração padrão permite execução local sem autenticação', () => {
  const config = readConfig({});
  assert.equal(config.port, 3000);
  assert.equal(config.host, '0.0.0.0');
  assert.ok(config.allowedHosts.includes('localhost'));
});

test('porta inválida impede inicialização', () => {
  for (const port of ['', 'abc', '3000.5', '-1', '0', '65536']) {
    assert.throws(() => readConfig({ PORT: port }), /PORT/);
  }
});

test('escuta pública em produção requer hosts exatos e aceita configuração explícita', () => {
  assert.throws(() => readConfig({ NODE_ENV: 'production' }), /PUBLIC_DOMAIN/);
  assert.throws(() => readConfig({ NODE_ENV: 'production', HOST: '::' }), /PUBLIC_DOMAIN/);
  assert.throws(() => readConfig({ HOST: '0.0.0.0', ALLOWED_HOSTS: '*' }), /ALLOWED_HOSTS/);
  const config = readConfig({
    NODE_ENV: 'production', PORT: '8080', HOST: '0.0.0.0',
    ALLOWED_HOSTS: 'mcp.fecci.test, localhost',
    ALLOWED_ORIGINS: 'https://cliente.fecci.test',
  });
  assert.equal(config.port, 8080);
  assert.deepEqual(config.allowedHosts, ['mcp.fecci.test', 'localhost']);
  assert.deepEqual(config.allowedOrigins, ['https://cliente.fecci.test']);
});

test('Render fornece porta e domínio sem configuração manual de allowlist', () => {
  const config = readConfig({
    NODE_ENV: 'production', PORT: '10000',
    RENDER_EXTERNAL_HOSTNAME: 'fecci-fusion-mcp.onrender.com',
  });
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 10000);
  assert.deepEqual(config.allowedHosts, ['fecci-fusion-mcp.onrender.com']);
});

test('domínio próprio, hostname do Render e hosts extras continuam permitidos', () => {
  const config = readConfig({
    NODE_ENV: 'production', PUBLIC_DOMAIN: ' MCP.FECCI.TEST ',
    RENDER_EXTERNAL_HOSTNAME: 'fecci-fusion-mcp.onrender.com',
    ALLOWED_HOSTS: 'outro.fecci.test, mcp.fecci.test',
  });
  assert.deepEqual(config.allowedHosts, [
    'mcp.fecci.test', 'fecci-fusion-mcp.onrender.com', 'outro.fecci.test',
  ]);
  assert.deepEqual(config.allowedOrigins, []);
});

test('domínios inválidos e curingas impedem inicialização', () => {
  for (const variable of ['PUBLIC_DOMAIN', 'RENDER_EXTERNAL_HOSTNAME', 'ALLOWED_HOSTS']) {
    for (const value of ['*', '*.fecci.test', 'https://mcp.fecci.test', 'mcp.fecci.test:443', 'mcp.fecci.test/mcp']) {
      assert.throws(() => readConfig({ [variable]: value }), new RegExp(variable));
    }
  }
});

test('origem inválida impede inicialização', () => {
  assert.throws(() => readConfig({ ALLOWED_ORIGINS: 'cliente.fecci.test' }), /ALLOWED_ORIGINS/);
  assert.throws(() => readConfig({ ALLOWED_ORIGINS: 'https://cliente.fecci.test/caminho' }), /ALLOWED_ORIGINS/);
  assert.throws(() => readConfig({ ALLOWED_ORIGINS: '*' }), /ALLOWED_ORIGINS/);
  assert.throws(() => readConfig({ ALLOWED_ORIGINS: 'null' }), /ALLOWED_ORIGINS/);
});
