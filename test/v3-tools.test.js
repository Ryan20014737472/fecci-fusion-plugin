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
import { loadDocumentDataset, validateDocumentProvenance } from '../src/data/document-datasets.js';

const calls = [
  { name: 'get_project_documents', arguments: {} },
  { name: 'search_documents', arguments: { query: 'extrusão' } },
  { name: 'get_methodology', arguments: {} },
  { name: 'get_theoretical_foundation', arguments: {} },
];
const validator = new AjvJsonSchemaValidator();
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
let httpServer;
let client;
let tools;
let baseline;
let registry;

before(async () => {
  baseline = JSON.parse(await readFile(new URL('./fixtures/v2-contracts.json', import.meta.url), 'utf8'));
  registry = await loadDocumentDataset('documents');
  httpServer = createApp().listen(0, '127.0.0.1');
  await once(httpServer, 'listening');
  client = new Client({ name: 'fecci-v3-test', version: '1.0.0' });
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

async function connectMemory(t, options) {
  const server = createMcpServer(options);
  const memoryClient = new Client({ name: 'fecci-v3-memory', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await memoryClient.close(); await server.close(); });
  await server.connect(b);
  await memoryClient.connect(a);
  await memoryClient.listTools();
  return memoryClient;
}

function checkProvenance(value) {
  if (!value || typeof value !== 'object') return;
  if (Object.hasOwn(value, 'source_url')) {
    assert.equal(new URL(value.source_url).protocol, 'https:');
    assert.ok(value.document_title);
    assert.match(value.source_checked_at, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Object.hasOwn(value, 'page'));
    assert.ok(Object.hasOwn(value, 'section'));
  }
  if (Object.hasOwn(value, 'provenance')) assert.ok(value.provenance.length > 0);
  if (Object.hasOwn(value, 'content') && Object.hasOwn(value, 'status') && !Object.hasOwn(value, 'source_url')) {
    assert.ok(value.provenance?.length > 0, `Fato sem proveniência: ${value.id}`);
  }
  Object.values(value).forEach(checkProvenance);
}

test('V3: tools/list anuncia exatamente onze ferramentas, preservando a ordem das sete anteriores', () => {
  assert.deepEqual(tools.map(({ name }) => name), [...baseline.tools.map(({ name }) => name), ...calls.map(({ name }) => name)]);
});

for (const tool of calls) {
  test(`${tool.name}: descoberta com esquemas estritos, descrição e somente leitura`, () => {
    const listed = tools.find(({ name }) => name === tool.name);
    assert.ok(listed.description.length > 80);
    assert.equal(listed.inputSchema.additionalProperties, false);
    assert.equal(listed.outputSchema.additionalProperties, false);
    assert.deepEqual(listed.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    assert.equal(validator.getValidator(listed.inputSchema)(tool.arguments).valid, true);
  });

  test(`${tool.name}: chamada válida retorna structuredContent conforme o schema e proveniência verificável`, async () => {
    const result = await client.callTool(tool);
    assert.notEqual(result.isError, true);
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    const check = validator.getValidator(tools.find(({ name }) => name === tool.name).outputSchema);
    assert.equal(check(result.structuredContent).valid, true);
    checkProvenance(result.structuredContent);
    validateDocumentProvenance(result.structuredContent, registry);
    assert.equal(check({ ...result.structuredContent, source_checked_at: '2026-02-30' }).valid, false);
    assert.equal(check({ ...result.structuredContent, sources: [] }).valid, false);
    assert.equal(check({ ...result.structuredContent, private_field: true }).valid, false);
    if (tool.name !== 'search_documents') assert.deepEqual(await client.callTool({ name: tool.name }), result);
  });

  test(`${tool.name}: argumentos extras são rejeitados sem interromper a próxima chamada`, async () => {
    const result = await client.callTool({ name: tool.name, arguments: { ...tool.arguments, unexpected: 'field' } });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.notEqual((await client.callTool(tool)).isError, true);
  });

  test(`${tool.name}: falhas e dados inválidos retornam mensagem genérica sem detalhes internos`, async (t) => {
    for (const invalid of [false, true]) {
      let logged = false;
      const broken = await connectMemory(t, {
        loadDocumentDataset: async () => {
          if (invalid) return {};
          throw new Error('/private/path/ENOTPUBLIC');
        },
        logger: { error: () => { logged = true; } },
      });
      const result = await broken.callTool(tool);
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent, undefined);
      assert.equal(logged, true);
      assert.deepEqual(result.content, [{ type: 'text', text: 'Não foi possível consultar as informações públicas solicitadas do Projeto FECCI.' }]);
      assert.doesNotMatch(JSON.stringify(result), /ENOTPUBLIC|private\/path|stack|ZodError|TypeError/);
      assert.equal(digest(await broken.callTool({ name: 'get_project_info', arguments: {} })), baseline.tools[0].success_sha256);
    }
  });
}

for (const name of ['get_project_info', 'search_project', 'get_team', 'get_references', 'get_workshop_info', 'get_results', 'get_project_timeline']) {
  test(`V2: definição completa de ${name} permanece idêntica ao commit estável`, () => {
    assert.equal(digest(tools.find((tool) => tool.name === name)), baseline.tools.find((tool) => tool.name === name).definition_sha256);
  });
  if (name !== 'search_project') {
    test(`V2: sucesso e erro completos de ${name} permanecem idênticos`, async (t) => {
      const snapshot = baseline.tools.find((tool) => tool.name === name);
      assert.equal(digest(await client.callTool({ name, arguments: {} })), snapshot.success_sha256);
      const fail = async () => { throw new Error('private'); };
      const broken = await connectMemory(t, { loadProjectInfo: fail, loadDataset: fail, loadSearchBase: fail, logger: { error() {} } });
      assert.equal(digest(await broken.callTool({ name, arguments: {} })), snapshot.error_sha256);
    });
  }
}

test('V2: search_project conserva resposta anterior quando não há trechos documentais adicionais', async (t) => {
  const corpus = await loadDocumentDataset('corpus');
  const empty = await connectMemory(t, { loadDocumentDataset: async () => ({ ...corpus, excerpts: [] }) });
  const previous = baseline.tools.find(({ name }) => name === 'search_project');
  assert.equal(digest(await empty.callTool({ name: 'search_project', arguments: previous.arguments })), previous.success_sha256);
});

test('V2: search_project conserva o erro público anterior mesmo se falhar a nova base documental', async (t) => {
  const broken = await connectMemory(t, {
    loadDocumentDataset: async () => { throw new Error('/private/document-corpus.json'); },
    logger: { error() {} },
  });
  const previous = baseline.tools.find(({ name }) => name === 'search_project');
  assert.equal(digest(await broken.callTool({ name: 'search_project', arguments: previous.arguments })), previous.error_sha256);
});

test('V2: search_project aceita apenas query e respostas V3 são válidas no schema antigo', async () => {
  const query = { query: 'Tinkercad' };
  assert.equal(validator.getValidator(baseline.search_input_schema)(query).valid, true);
  const result = await client.callTool({ name: 'search_project', arguments: query });
  assert.notEqual(result.isError, true);
  assert.equal(validator.getValidator(baseline.search_output_schema)(result.structuredContent).valid, true);
  const excerpt = result.structuredContent.results.find(({ id }) => id === 'document-guide-navigation-style');
  assert.ok(excerpt);
  assert.match(excerpt.title, /Material de apoio/);
  assert.match(excerpt.content, /Página: 6/);
  assert.match(excerpt.content, /Seção: Atalhos/);
  assert.match(excerpt.content, /URL: https:\/\//);
  assert.ok(excerpt.sources.some(({ url }) => url.endsWith('.pdf#page=6')));
  const invalid = await client.callTool({ name: 'search_project', arguments: { ...query, limit: 1 } });
  assert.equal(invalid.isError, true);
});

test('V2: search_project inclui URL direta do Canva no texto sem acrescentar campos incompatíveis', async () => {
  const result = await client.callTool({ name: 'search_project', arguments: { query: 'Bordo Maker' } });
  assert.notEqual(result.isError, true);
  const excerpt = result.structuredContent.results.find(({ id }) => id === 'document-journal-name');
  assert.ok(excerpt);
  assert.match(excerpt.content, /Página: 3/);
  assert.match(excerpt.content, /https:\/\/canva\.link\/ino42l26d4v7d6u/);
  assert.ok(excerpt.sources.some(({ url }) => url.endsWith('#diario')));
  assert.equal(validator.getValidator(baseline.search_output_schema)(result.structuredContent).valid, true);
});

test('get_project_documents inventaria PDFs e Canva com disponibilidade, páginas e escopo de indexação', async () => {
  const { structuredContent: data } = await client.callTool({ name: 'get_project_documents', arguments: {} });
  assert.equal(data.documents.length, 6);
  assert.deepEqual(data.documents.map(({ page_count }) => page_count), [5, 7, 11, 20, 23, 20]);
  assert.equal(data.documents.filter(({ corpus_included }) => corpus_included).length, 3);
  assert.ok(data.documents.every(({ availability }) => availability === 'available'));
  assert.equal(data.documents[2].page_basis, 'canva_design_order');
  assert.ok(data.documents.filter(({ type }) => type === 'bibliographic_reference').every(({ verification_method, corpus_included }) => verification_method === 'pdf_metadata' && !corpus_included));
});

for (const [type, query, expected] of [
  ['project_article', 'modelagem', true],
  ['support_material', 'modelagem', true],
  ['project_journal', 'Maker', true],
  ['bibliographic_reference', 'impressão', false],
]) {
  test(`search_documents: filtro ${type} consulta apenas os trechos desse tipo`, async () => {
    const result = await client.callTool({ name: 'search_documents', arguments: { query, document_type: type, limit: 10 } });
    assert.notEqual(result.isError, true);
    const data = result.structuredContent;
    assert.equal(data.document_type, type);
    assert.equal(data.match_count > 0, expected);
    assert.ok(data.results.every(({ document_type }) => document_type === type));
  });
}

for (const limit of [1, 5, 10]) {
  test(`search_documents: limit=${limit} restringe a resposta e preserva o total`, async () => {
    const result = await client.callTool({ name: 'search_documents', arguments: { query: 'modelagem', limit } });
    assert.notEqual(result.isError, true);
    assert.ok(result.structuredContent.match_count > 10);
    assert.equal(result.structuredContent.results.length, limit);
    assert.equal(result.structuredContent.limit, limit);
  });
}

test('search_documents: limite padrão 5, rank sequencial e pontuação decrescente', async () => {
  const { structuredContent: data } = await client.callTool({ name: 'search_documents', arguments: { query: 'modelagem' } });
  assert.equal(data.limit, 5);
  assert.equal(data.results.length, 5);
  assert.deepEqual(data.results.map(({ rank }) => rank), [1, 2, 3, 4, 5]);
  assert.ok(data.results.every(({ score }, index) => index === 0 || score <= data.results[index - 1].score));
});

test('search_documents: ranking prioriza explicação da ferramenta sobre lista geral de atalhos', async () => {
  const { structuredContent: data } = await client.callTool({ name: 'search_documents', arguments: { query: 'extrusão' } });
  assert.equal(data.results[0].id, 'guide-tool-extrude');
  assert.equal(data.results[0].page, 4);
  assert.equal(data.results[0].section, 'Ferramentas utilizadas na oficina');
});

test('search_documents: normalização portuguesa ignora caixa, acentos e espaços externos', async () => {
  const a = await client.callTool({ name: 'search_documents', arguments: { query: '  modelagem paramétrica  ' } });
  const b = await client.callTool({ name: 'search_documents', arguments: { query: 'MODELAGEM PARAMETRICA' } });
  assert.equal(a.structuredContent.query, 'modelagem paramétrica');
  assert.ok(a.structuredContent.match_count > 0);
  assert.deepEqual(a.structuredContent.results, b.structuredContent.results);
});

test('search_documents: nenhuma correspondência é resposta normal com lista vazia e proveniência', async () => {
  const result = await client.callTool({ name: 'search_documents', arguments: { query: 'termodocumentalzzxinexistente' } });
  assert.notEqual(result.isError, true);
  assert.equal(result.structuredContent.match_count, 0);
  assert.deepEqual(result.structuredContent.results, []);
  assert.match(result.structuredContent.message, /Nenhum trecho correspondente/);
  assert.ok(result.structuredContent.sources.length > 0);
});

const invalidSearch = [
  ['sem query', {}], ['query numérica', { query: 7 }], ['query null', { query: null }],
  ['query vazia', { query: '' }], ['só espaços', { query: '   ' }], ['só pontuação', { query: '!!!' }],
  ['só palavras de ligação', { query: 'o e de para' }], ['query longa', { query: 'a'.repeat(201) }],
  ['tipo inexistente', { query: 'Fusion', document_type: 'unknown' }],
  ['tipo null', { query: 'Fusion', document_type: null }],
  ['limit zero', { query: 'Fusion', limit: 0 }], ['limit acima de dez', { query: 'Fusion', limit: 11 }],
  ['limit fracionário', { query: 'Fusion', limit: 1.5 }], ['limit string', { query: 'Fusion', limit: '2' }],
  ['limit null', { query: 'Fusion', limit: null }],
];
for (const [label, args] of invalidSearch) {
  test(`search_documents: rejeita ${label}`, async () => {
    const result = await client.callTool({ name: 'search_documents', arguments: args });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
  });
}

test('get_methodology separa dez seções com status por fato e divergências explícitas', async () => {
  const { structuredContent: data } = await client.callTool({ name: 'get_methodology', arguments: {} });
  assert.equal(Object.keys(data.sections).length, 10);
  assert.ok(Object.values(data.sections).every(({ facts }) => facts.length && facts.every(({ provenance }) => provenance.length)));
  assert.ok(data.ambiguities.some(({ id }) => id === 'ambiguity-audience'));
  assert.ok(data.ambiguities.some(({ id }) => id === 'ambiguity-classes'));
});

test('get_theoretical_foundation inclui seis referências sem alterar as três referências da V2', async () => {
  const { structuredContent: theory } = await client.callTool({ name: 'get_theoretical_foundation', arguments: {} });
  assert.equal(theory.references.length, 6);
  assert.ok(theory.references.some(({ id }) => id === 'anderson'));
  assert.ok(theory.references.some(({ id }) => id === 'lipson-kurman'));
  const evangelista = theory.references.find(({ id }) => id === 'evangelista');
  assert.equal(evangelista.year, 2021);
  assert.deepEqual(evangelista.citation_variants.map(({ year }) => year), [2026, 2021]);
  assert.equal(evangelista.notes[0].status, 'ambiguous');
  assert.equal(theory.references.find(({ id }) => id === 'anderson').methodology_link.status, 'not_published');
  const v2 = await client.callTool({ name: 'get_references', arguments: {} });
  assert.equal(v2.structuredContent.bibliography.length, 3);
});

test('as onze ferramentas mantêm leitura, idempotência e arquivos de dados intactos', async () => {
  const root = new URL('../data/', import.meta.url);
  async function hashes() {
    const files = (await readdir(root)).filter((file) => file.endsWith('.json')).sort();
    return Promise.all(files.map(async (file) => [file, digest(await readFile(new URL(file, root), 'utf8'))]));
  }
  const before = await hashes();
  for (const tool of tools) {
    assert.deepEqual(tool.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    const args = tool.name.startsWith('search_') ? { query: 'modelagem' } : {};
    assert.deepEqual(await client.callTool({ name: tool.name, arguments: args }), await client.callTool({ name: tool.name, arguments: args }));
  }
  assert.deepEqual(await hashes(), before);
});
