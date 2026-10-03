import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadDataset, loadSearchBase } from '../src/data/project-datasets.js';
import { searchOutputSchema } from '../src/data/project-schemas.js';
import { buildSearchDocuments, searchProject } from '../src/search/project-search.js';

let base;
before(async () => { base = await loadSearchBase(); });

test('busca indexa os seis arquivos locais e cada trecho preserva fonte e data do conjunto', () => {
  const documents = buildSearchDocuments(base);
  assert.equal(new Set(documents.map(({ id }) => id)).size, documents.length);
  for (const prefix of ['project-info', 'team-member', 'reference-', 'workshop-', 'obtained-', 'timeline-']) {
    assert.ok(documents.some(({ id }) => id.startsWith(prefix)));
  }
  assert.ok(documents.every(({ title, content, sources, source_checked_at }) => title && content && sources.length && source_checked_at));
});

test('busca exige todos os termos significativos no mesmo trecho', () => {
  const result = searchProject('parafuso termoindisponivelxyz', base);
  assert.equal(result.match_count, 0);
  assert.deepEqual(result.results, []);
  const valid = searchProject('o parafuso e a porca', base);
  assert.ok(valid.match_count > 0);
  assert.equal(valid.results[0].id, 'workshop-practice');
});

test('busca aceita prefixos com pelo menos quatro letras e mantém prioridade do título', () => {
  assert.equal(searchProject('paraf', base).results[0].id, 'workshop-practice');
  assert.equal(searchProject('Ryan', base).results[0].id, 'team-member-3');
  assert.equal(searchProject('referências', base).results[0].id, 'references-overview');
  assert.equal(searchProject('90 minutos', base).results[0].id, 'workshop-info');
  assert.equal(searchProject('par', base).match_count, 0);
});

test('busca limita a dez resultados, informa o total e mantém ordem determinística', () => {
  const result = searchProject('projeto', base);
  assert.ok(result.match_count > 10);
  assert.equal(result.results.length, 10);
  assert.deepEqual(searchProject('projeto', base), result);
  assert.deepEqual(searchOutputSchema.parse(result), result);
});

test('busca conserva datas de cada conjunto e informa a mais antiga na proveniência geral', () => {
  const mixed = structuredClone(base);
  mixed.team.source_checked_at = '2026-09-01';
  const result = searchProject('Ryan', mixed);
  assert.equal(result.source_checked_at, '2026-09-01');
  assert.equal(result.results[0].source_checked_at, '2026-09-01');
  assert.equal(result.results.find(({ id }) => id === 'resource-5').source_checked_at, base.references.source_checked_at);
});

test('busca mantém explícito quando um trecho é etapa pendente ou informação não publicada', () => {
  const pending = searchProject('indicadores', base);
  assert.ok(pending.results.some(({ title }) => title.startsWith('Etapa pendente:')));
  const dates = searchProject('datas', base);
  assert.ok(dates.results.some(({ title, content }) => /não publicadas/.test(title) && /datas/.test(content)));
  assert.ok(searchProject('questionários', base).results.length > 0);
});

test('carregador só aceita conjuntos fixos; nomes e caminhos arbitrários são rejeitados', async () => {
  for (const name of ['../package.json', 'constructor', 'toString', 'missing']) {
    await assert.rejects(loadDataset(name), /Conjunto de dados desconhecido/);
  }
});
