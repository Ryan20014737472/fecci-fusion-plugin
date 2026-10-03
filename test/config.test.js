import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/config.js';

test('configuração padrão permite execução local sem autenticação', () => {
  const config = readConfig({});
  assert.equal(config.port, 3000);
  assert.equal(config.host, '127.0.0.1');
  assert.ok(config.allowedHosts.includes('localhost'));
});

test('porta inválida impede inicialização', () => {
  for (const port of ['', 'abc', '3000.5', '-1', '0', '65536']) {
    assert.throws(() => readConfig({ PORT: port }), /PORT/);
  }
});

test('escuta pública requer hosts exatos e aceita configuração explícita', () => {
  assert.throws(() => readConfig({ HOST: '0.0.0.0' }), /ALLOWED_HOSTS/);
  assert.throws(() => readConfig({ HOST: '0.0.0.0', ALLOWED_HOSTS: '*' }), /ALLOWED_HOSTS/);
  const config = readConfig({
    PORT: '8080', HOST: '0.0.0.0',
    ALLOWED_HOSTS: 'mcp.fecci.test, localhost',
    ALLOWED_ORIGINS: 'https://cliente.fecci.test',
  });
  assert.equal(config.port, 8080);
  assert.deepEqual(config.allowedHosts, ['mcp.fecci.test', 'localhost']);
  assert.deepEqual(config.allowedOrigins, ['https://cliente.fecci.test']);
});

test('origem inválida impede inicialização', () => {
  assert.throws(() => readConfig({ ALLOWED_ORIGINS: 'cliente.fecci.test' }), /ALLOWED_ORIGINS/);
  assert.throws(() => readConfig({ ALLOWED_ORIGINS: 'https://cliente.fecci.test/caminho' }), /ALLOWED_ORIGINS/);
});
