import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { getProjectInfo } from '../src/data/project-info.js';

const config = readConfig({
  NODE_ENV: 'production',
  PUBLIC_DOMAIN: 'mcp.fecci.test',
  RENDER_EXTERNAL_HOSTNAME: 'fecci-fusion-mcp.onrender.com',
  ALLOWED_ORIGINS: 'https://cliente.fecci.test',
});
let httpServer;
let baseUrl;
let dataReads = 0;

before(async () => {
  httpServer = createApp({
    ...config,
    loadProjectInfo: async () => {
      dataReads += 1;
      return getProjectInfo();
    },
  }).listen(0, '127.0.0.1');
  await once(httpServer, 'listening');
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    httpServer.close((error) => error ? reject(error) : resolve());
    httpServer.closeIdleConnections();
  });
});

function send(path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(baseUrl + path, {
      method,
      headers: { Host: config.allowedHosts[0], ...headers },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.once('error', reject);
      res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text }));
    });
    req.once('error', reject);
    req.end(body);
  });
}

test('/health aceita domínio próprio e hostname do Render sem expor dados internos', async () => {
  const readsBefore = dataReads;
  for (const host of config.allowedHosts) {
    const response = await send('/health', { headers: { Host: `${host}:443` } });
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-powered-by'], undefined);
    const head = await send('/health', { method: 'HEAD', headers: { Host: host } });
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
  }
  assert.equal(dataReads, readsBefore);
});

test('/health rejeita métodos de escrita', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const response = await send('/health', { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, 'GET, HEAD');
  }
});

test('/mcp público preserva get_project_info com e sem Origin permitido', async () => {
  const expected = await getProjectInfo();
  for (const host of config.allowedHosts) {
    for (const origin of [undefined, config.allowedOrigins[0]]) {
      const response = await send('/mcp', {
        method: 'POST',
        headers: {
          Host: host,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2025-11-25',
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'tools/call',
          params: { name: 'get_project_info', arguments: {} },
        }),
      });
      assert.equal(response.status, 200);
      const { result } = JSON.parse(response.body);
      assert.notEqual(result.isError, true);
      assert.deepEqual(result.structuredContent, expected);
      assert.deepEqual(JSON.parse(result.content[0].text), expected);
    }
  }
});

test('validação de Host e Origin protege /health e /mcp sem confiar em cabeçalhos encaminhados', async () => {
  for (const path of ['/health', '/mcp']) {
    const options = path === '/mcp' ? { method: 'POST' } : {};
    const invalidHost = await send(path, {
      ...options,
      headers: { Host: 'invalido.test', 'X-Forwarded-Host': config.allowedHosts[0] },
    });
    assert.equal(invalidHost.status, 403);
    const invalidOrigin = await send(path, {
      ...options,
      headers: { Origin: 'https://invalido.test' },
    });
    assert.equal(invalidOrigin.status, 403);
    const nullOrigin = await send(path, { ...options, headers: { Origin: 'null' } });
    assert.equal(nullOrigin.status, 403);
  }
});
