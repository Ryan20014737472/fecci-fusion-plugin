import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { createApp } from '../src/app.js';
import { createMcpServer } from '../src/mcp-server.js';
import { OFFICIAL_SITE_URL } from '../src/data/project-schemas.js';

const newTools = [
  { name: 'search_project', arguments: { query: 'parafuso porca' } },
  { name: 'get_team', arguments: {} },
  { name: 'get_references', arguments: {} },
  { name: 'get_workshop_info', arguments: {} },
  { name: 'get_results', arguments: {} },
  { name: 'get_project_timeline', arguments: {} },
];
const validator = new AjvJsonSchemaValidator();
let httpServer;
let client;
let tools;
let v1;

before(async () => {
  v1 = JSON.parse(await readFile(new URL('./fixtures/get-project-info-v1.json', import.meta.url), 'utf8'));
  httpServer = createApp().listen(0, '127.0.0.1');
  await once(httpServer, 'listening');
  client = new Client({ name: 'fecci-v2-test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${httpServer.address().port}/mcp`)));
  tools = (await client.listTools()).tools;
});

after(async () => {
  await client?.close();
  if (httpServer) {
    await new Promise((resolve, reject) => {
      httpServer.close((error) => error ? reject(error) : resolve());
      httpServer.closeIdleConnections();
    });
  }
});

function assertSources(value) {
  if (value === null || typeof value !== 'object') return;
  if (Object.hasOwn(value, 'sources')) {
    assert.ok(value.sources.length > 0);
    for (const source of value.sources) {
      assert.ok(source.section.length > 0);
      assert.ok(source.url.startsWith(OFFICIAL_SITE_URL));
      assert.equal(new URL(source.url).origin, new URL(OFFICIAL_SITE_URL).origin);
    }
  }
  for (const child of Object.values(value)) assertSources(child);
}

async function connectInMemory(t, options) {
  const server = createMcpServer(options);
  const memoryClient = new Client({ name: 'fecci-error-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await memoryClient.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await memoryClient.connect(clientTransport);
  await memoryClient.listTools();
  return memoryClient;
}

for (const tool of newTools) {
  test(`${tool.name}: tools/list anuncia descrição, esquemas e anotações de leitura`, () => {
    const discovered = tools.find(({ name }) => name === tool.name);
    assert.ok(discovered);
    assert.ok(discovered.title.length > 0);
    assert.ok(discovered.description.length > 80);
    assert.equal(discovered.inputSchema.type, 'object');
    assert.equal(discovered.inputSchema.additionalProperties, false);
    assert.equal(discovered.outputSchema.type, 'object');
    assert.equal(discovered.outputSchema.additionalProperties, false);
    assert.deepEqual(discovered.annotations, {
      readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
    });
    assert.equal(validator.getValidator(discovered.inputSchema)(tool.arguments).valid, true);
    assert.equal(validator.getValidator(discovered.inputSchema)({ ...tool.arguments, unexpected: true }).valid, false);
  });

  test(`${tool.name}: chamada válida respeita o outputSchema publicado e inclui fontes`, async () => {
    const result = await client.callTool(tool);
    assert.notEqual(result.isError, true);
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    const check = validator.getValidator(tools.find(({ name }) => name === tool.name).outputSchema);
    assert.equal(check(result.structuredContent).valid, true);
    assertSources(result.structuredContent);
    const missingSources = structuredClone(result.structuredContent);
    delete missingSources.sources;
    assert.equal(check(missingSources).valid, false);
    const badDate = { ...result.structuredContent, source_checked_at: '2026-02-30' };
    assert.equal(check(badDate).valid, false);
    assert.equal(check({ ...result.structuredContent, sources: [] }).valid, false);
    assert.equal(check({ ...result.structuredContent, sources: [{ section: 'Fake', url: 'https://example.com/' }] }).valid, false);
    assert.equal(check({ ...result.structuredContent, private_field: 'not-in-contract' }).valid, false);
    if (tool.name === 'search_project') {
      assert.ok(result.structuredContent.results.length > 0);
      assert.equal(result.structuredContent.results[0].id, 'workshop-practice');
    } else {
      assert.ok(result.structuredContent.not_published.length > 0);
      const implicitArguments = await client.callTool({ name: tool.name });
      assert.deepEqual(implicitArguments, result);
    }
  });

  test(`${tool.name}: argumentos inesperados são rejeitados e a chamada seguinte funciona`, async () => {
    const result = await client.callTool({ name: tool.name, arguments: { ...tool.arguments, unexpected: true } });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    const next = await client.callTool(tool);
    assert.notEqual(next.isError, true);
  });

  test(`${tool.name}: falhas e dados locais inválidos retornam erro genérico sem detalhes internos`, async (t) => {
    for (const invalidData of [false, true]) {
      let logged = false;
      const fail = async () => {
        if (invalidData) return {};
        throw new Error('internal-private-file-path-and-details');
      };
      const brokenClient = await connectInMemory(t, {
        loadDataset: fail,
        loadSearchBase: fail,
        logger: { error: () => { logged = true; } },
      });
      const result = await brokenClient.callTool(tool);
      assert.equal(result.isError, true);
      assert.equal(logged, true);
      assert.deepEqual(result.content, [{ type: 'text', text: 'Não foi possível consultar as informações públicas solicitadas do Projeto FECCI.' }]);
      assert.equal(result.structuredContent, undefined);
      assert.doesNotMatch(JSON.stringify(result), /internal-private|TypeError|ZodError|stack|ENOENT/);
      const unaffected = await brokenClient.callTool({ name: 'get_project_info', arguments: {} });
      assert.deepEqual(unaffected, v1.success);
    }
  });
}

test('V1: definição completa de get_project_info permanece exatamente igual', () => {
  assert.deepEqual(tools.find(({ name }) => name === 'get_project_info'), v1.tool);
});

test('V1: structuredContent e texto completo permanecem exatamente iguais, com ou sem arguments', async () => {
  assert.deepEqual(await client.callTool({ name: 'get_project_info', arguments: {} }), v1.success);
  assert.deepEqual(await client.callTool({ name: 'get_project_info' }), v1.success);
});

test('V1: resposta de erro de get_project_info permanece exatamente igual', async (t) => {
  const brokenClient = await connectInMemory(t, {
    loadProjectInfo: async () => { throw new Error('private'); },
    logger: { error: () => {} },
  });
  assert.deepEqual(await brokenClient.callTool({ name: 'get_project_info', arguments: {} }), v1.error);
});

async function datasetHashes() {
  const directory = new URL('../data/', import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith('.json')).sort();
  return Promise.all(files.map(async (file) => [file, createHash('sha256').update(await readFile(new URL(file, directory))).digest('hex')]));
}

test('todas as sete ferramentas são idempotentes e preservam os arquivos de dados', async () => {
  const hashes = await datasetHashes();
  const calls = [{ name: 'get_project_info', arguments: {} }, ...newTools];
  for (const tool of calls) {
    const annotations = tools.find(({ name }) => name === tool.name).annotations;
    assert.equal(annotations.readOnlyHint, true);
    assert.equal(annotations.destructiveHint, false);
    assert.equal(annotations.idempotentHint, true);
    assert.deepEqual(await client.callTool(tool), await client.callTool(tool));
  }
  assert.deepEqual(await datasetHashes(), hashes);
});

test('get_team preserva os nomes publicados em cada contexto e seus papéis', async () => {
  const { structuredContent: team } = await client.callTool({ name: 'get_team', arguments: {} });
  assert.deepEqual(team.members.map(({ name }) => name), ['Helton Limberger', 'Renan Decker', 'Ryan Batistel', 'Arthur Dutra']);
  assert.ok(team.members.every(({ role, responsibilities }) => role && responsibilities));
  assert.ok(team.article_authorship.names.includes('Ryan Victor do Amaral Batistel'));
  assert.ok(team.additional_public_roles.some(({ name }) => name === 'Bruno Antunes Martins'));
});

test('get_references distingue bibliografia de materiais e links públicos', async () => {
  const { structuredContent: refs } = await client.callTool({ name: 'get_references', arguments: {} });
  assert.deepEqual(refs.bibliography.map(({ doi }) => doi), [
    '10.26512/2446-564X2021e35946', '10.47456/bjpe.v11i3.48046', '10.23925/1983-3156.2023v25i2p258-277',
  ]);
  assert.ok(refs.bibliography.every(({ authors, citation_as_published, pdf_url }) => authors.length && citation_as_published && pdf_url));
  assert.ok(refs.additional_materials.some(({ category }) => category === 'support_material'));
});

test('get_workshop_info fornece objetivo, público, duração, conteúdos e atividade com apoio', async () => {
  const { structuredContent: workshop } = await client.callTool({ name: 'get_workshop_info', arguments: {} });
  assert.ok(workshop.objective);
  assert.match(workshop.target_audience, /15 a 18/);
  assert.equal(workshop.duration_minutes, 90);
  assert.deepEqual(workshop.contents.map(({ order }) => order), [1, 2, 3, 4, 5]);
  assert.match(workshop.practical_activity.description, /parafuso.*porca/);
  assert.equal(workshop.support_material.pages, 7);
  assert.match(workshop.status, /piloto.*concluída/i);
});

test('get_results separa evidências já obtidas, instrumentos preparados e etapas pendentes', async () => {
  const { structuredContent: results } = await client.callTool({ name: 'get_results', arguments: {} });
  assert.equal(results.quantitative_results.status, 'not_published');
  assert.match(results.quantitative_results.explanation, /terceiros/);
  assert.ok(results.obtained_results.some(({ title }) => /piloto.*concluída/i.test(title)));
  assert.ok(results.prepared_instruments.length > 0);
  assert.ok(results.pending_steps.some(({ title }) => /Aplicação/.test(title)));
  const coordination = results.obtained_results.find(({ title }) => /7 turmas/.test(title));
  assert.match(coordination.content, /não afirma.*já foi aplicado/);
  assert.doesNotMatch(JSON.stringify(results), /46[,.]4\s*%/);
});

test('get_project_timeline segue a sequência pública sem inventar datas ou ordenar registros ambíguos', async () => {
  const { structuredContent: timeline } = await client.callTool({ name: 'get_project_timeline', arguments: {} });
  assert.equal(timeline.chronology_basis, 'published_sequence');
  assert.deepEqual(timeline.events.map(({ order }) => order), [1, 2, 3, 4, 5, 6]);
  assert.ok(timeline.events.every(({ date }) => date === null));
  assert.ok(timeline.events.slice(0, 5).every(({ status }) => status === 'documented'));
  assert.equal(timeline.events[5].status, 'planned');
  assert.equal(timeline.undated_unordered_records[0].date, null);
  assert.match(timeline.undated_unordered_records[0].content, /7 turmas/);
});

const invalidSearchArguments = [
  ['query ausente', {}],
  ['query numérica', { query: 42 }],
  ['query vazia', { query: '' }],
  ['query com espaços', { query: '   ' }],
  ['query só com pontuação', { query: '!!!' }],
  ['query só com palavras de ligação', { query: 'o e de para' }],
  ['query acima de 200 caracteres', { query: 'x'.repeat(201) }],
];

for (const [label, args] of invalidSearchArguments) {
  test(`search_project: rejeita ${label}`, async () => {
    const result = await client.callTool({ name: 'search_project', arguments: args });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
  });
}

test('search_project: nenhuma correspondência retorna lista vazia, mensagem explícita e proveniência', async () => {
  const result = await client.callTool({ name: 'search_project', arguments: { query: 'termozxyinexistente' } });
  assert.notEqual(result.isError, true);
  assert.equal(result.structuredContent.match_count, 0);
  assert.deepEqual(result.structuredContent.results, []);
  assert.match(result.structuredContent.message, /Nenhuma informação correspondente/);
  assertSources(result.structuredContent);
  assert.equal(validator.getValidator(tools.find(({ name }) => name === 'search_project').outputSchema)(result.structuredContent).valid, true);
});

test('search_project: normaliza caixa e acentos e remove espaços externos', async () => {
  const a = await client.callTool({ name: 'search_project', arguments: { query: '  capacitação  ' } });
  const b = await client.callTool({ name: 'search_project', arguments: { query: 'CAPACITACAO' } });
  assert.equal(a.structuredContent.query, 'capacitação');
  assert.ok(a.structuredContent.match_count > 0);
  assert.deepEqual(a.structuredContent.results, b.structuredContent.results);
});
