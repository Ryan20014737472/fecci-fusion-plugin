import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { after, before, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../src/app.js';

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
  'MCP-Protocol-Version': '2025-11-25',
};

let httpServer;
let endpoint;

before(async () => {
  httpServer = createApp().listen(0, '127.0.0.1');
  await once(httpServer, 'listening');
  endpoint = `http://127.0.0.1:${httpServer.address().port}/mcp`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    httpServer.close((error) => error ? reject(error) : resolve());
    httpServer.closeIdleConnections();
  });
});

async function connectClient(t, url = endpoint) {
  const client = new Client({ name: 'fecci-mcp-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

function post(body, extraHeaders = {}) {
  return fetch(endpoint, {
    method: 'POST',
    headers: { ...headers, ...extraHeaders },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('cliente oficial inicializa e descobre as onze ferramentas de leitura', async (t) => {
  const client = await connectClient(t);
  assert.equal(client.getServerVersion().title, 'FECCI Fusion 360');
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name), [
    'get_project_info', 'search_project', 'get_team', 'get_references',
    'get_workshop_info', 'get_results', 'get_project_timeline',
    'get_project_documents', 'search_documents', 'get_methodology', 'get_theoretical_foundation',
  ]);
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[0].annotations.destructiveHint, false);
  assert.equal(tools[0].annotations.idempotentHint, true);
  assert.equal(tools[0].outputSchema.type, 'object');
});

test('get_project_info retorna dados estruturados, fontes e o estágio público do projeto', async (t) => {
  const client = await connectClient(t);
  const result = await client.callTool({ name: 'get_project_info', arguments: {} });
  assert.notEqual(result.isError, true);
  const info = result.structuredContent;
  assert.equal(info.name, 'Projeto FECCI');
  assert.equal(info.official_site_url, 'https://ryan20014737472.github.io/Fecci-fusion-360/');
  assert.ok(info.description.length > 0);
  assert.ok(info.areas.includes('STEAM'));
  assert.equal(info.public_information.workshop.duration_minutes, 90);
  assert.equal(info.public_information.workshop.status, 'Capacitação-piloto concluída');
  assert.match(info.public_information.results.quantitative_results_status, /somente depois/);
  assert.match(info.source_checked_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(info.sources.length > 0);
  assert.ok(info.sources.every((source) => source.url.startsWith(info.official_site_url)));
  assert.deepEqual(JSON.parse(result.content[0].text), info);
});

test('chamadas concorrentes com o mesmo ID não compartilham transporte', async () => {
  const payload = {
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'get_project_info', arguments: {} },
  };
  const responses = await Promise.all(Array.from({ length: 4 }, () => post(payload)));
  const bodies = await Promise.all(responses.map((response) => response.json()));
  responses.forEach((response) => {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('mcp-session-id'), null);
  });
  bodies.forEach((body) => {
    assert.equal(body.id, 1);
    assert.equal(body.result.structuredContent.name, 'Projeto FECCI');
  });
});

test('notificação initialized é aceita com HTTP 202', async () => {
  const response = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(response.status, 202);
  assert.equal(await response.text(), '');
});

test('JSON malformado é rejeitado e a próxima requisição funciona', async () => {
  const response = await post('{');
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, -32700);
  const next = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal(next.status, 200);
  assert.equal((await next.json()).result.tools[0].name, 'get_project_info');
});

test('corpo acima do limite é rejeitado com HTTP 413', async () => {
  const response = await post(JSON.stringify({ content: 'x'.repeat(70_000) }));
  assert.equal(response.status, 413);
  assert.equal((await response.json()).jsonrpc, '2.0');
});

test('Accept incompatível é rejeitado pelo transporte oficial', async () => {
  const response = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { Accept: 'application/json' });
  assert.equal(response.status, 406);
});

test('ferramenta inexistente e argumentos inesperados retornam erro MCP', async (t) => {
  const client = await connectClient(t);
  const unknown = await client.callTool({ name: 'unknown_tool', arguments: {} });
  assert.equal(unknown.isError, true);
  const invalid = await client.callTool({ name: 'get_project_info', arguments: { query: 'teste' } });
  assert.equal(invalid.isError, true);
  const valid = await client.callTool({ name: 'get_project_info', arguments: {} });
  assert.notEqual(valid.isError, true);
});

test('GET, DELETE e PUT informam que somente POST é permitido', async () => {
  for (const method of ['GET', 'DELETE', 'PUT']) {
    const response = await fetch(endpoint, { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
    assert.equal((await response.json()).jsonrpc, '2.0');
  }
});

test('Host e Origin não permitidos são rejeitados', async () => {
  // node:http permite enviar um Host customizado, ao contrário do fetch neste runtime.
  const hostStatus = await new Promise((resolve, reject) => {
    const req = request(endpoint, {
      method: 'POST',
      headers: { ...headers, Host: 'dominio-invalido.test' },
    }, (res) => {
      res.resume();
      res.once('end', () => resolve(res.statusCode));
    });
    req.once('error', reject);
    req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
  });
  assert.equal(hostStatus, 403);
  const origin = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { Origin: 'https://dominio-invalido.test' });
  assert.equal(origin.status, 403);
});

test('falha na leitura retorna isError sem expor detalhes internos', async (t) => {
  let loggedError = false;
  const brokenServer = createApp({
    loadProjectInfo: async () => { throw new Error('detalhe-interno-nao-publico'); },
    logger: { error: () => { loggedError = true; } },
  }).listen(0, '127.0.0.1');
  await once(brokenServer, 'listening');
  t.after(() => new Promise((resolve) => {
    brokenServer.close(resolve);
    brokenServer.closeIdleConnections();
  }));
  const url = `http://127.0.0.1:${brokenServer.address().port}/mcp`;
  const client = await connectClient(t, url);
  const result = await client.callTool({ name: 'get_project_info', arguments: {} });
  assert.equal(result.isError, true);
  assert.equal(loggedError, true);
  assert.doesNotMatch(JSON.stringify(result), /detalhe-interno-nao-publico/);
  assert.equal((await client.listTools()).tools.length, 11);
});
