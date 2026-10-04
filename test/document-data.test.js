import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadDocumentDataset, validateDocumentCorpus, validateDocumentProvenance } from '../src/data/document-datasets.js';
import { documentCorpusSchema, methodologySchema, theoreticalFoundationSchema } from '../src/data/document-schemas.js';
import { searchDocuments } from '../src/search/document-search.js';

let registry;
let corpus;
let method;
let foundation;
before(async () => {
  [registry, corpus, method, foundation] = await Promise.all(['documents', 'corpus', 'methodology', 'foundation'].map(loadDocumentDataset));
});

test('corpus tem cobertura real de três documentos, 18 páginas e 59 trechos rastreáveis', () => {
  assert.deepEqual(corpus.coverage, { documents_indexed: 3, pages_indexed: 18, excerpt_count: 59 });
  assert.equal(corpus.excerpts.filter(({ document_type }) => document_type === 'project_article').length, 28);
  assert.equal(corpus.excerpts.filter(({ document_type }) => document_type === 'support_material').length, 22);
  assert.equal(corpus.excerpts.filter(({ document_type }) => document_type === 'project_journal').length, 9);
  validateDocumentCorpus(corpus, registry);
  for (const excerpt of corpus.excerpts) {
    assert.ok(excerpt.page > 0);
    assert.ok(excerpt.source_url);
    assert.ok(Object.hasOwn(excerpt, 'section'));
  }
});

test('proveniência rejeita página inexistente, documento desconhecido, título e data incompatíveis', () => {
  const original = corpus.excerpts.find(({ document_id }) => document_id === 'project-article');
  for (const change of [
    { page: 99 }, { document_title: 'Documento inventado' },
    { source_url: 'https://ryan20014737472.github.io/Fecci-fusion-360/inexistente.pdf' },
    { source_checked_at: '2025-01-01' },
  ]) assert.throws(() => validateDocumentProvenance({ ...original, ...change }, registry), /Proveniência documental inválida/);
});

test('schemas rejeitam fatos sem proveniência, trechos sem página/seção e fontes externas não autorizadas', () => {
  const invalidMethod = structuredClone(method);
  delete invalidMethod.sections.planning.facts[0].provenance;
  assert.equal(methodologySchema.safeParse(invalidMethod).success, false);
  const invalidTheory = structuredClone(foundation);
  invalidTheory.references[0].concept_used.provenance = [];
  assert.equal(theoreticalFoundationSchema.safeParse(invalidTheory).success, false);
  for (const key of ['page', 'section', 'source_url', 'document_title', 'source_checked_at']) {
    const invalidCorpus = structuredClone(corpus);
    delete invalidCorpus.excerpts[0][key];
    assert.equal(documentCorpusSchema.safeParse(invalidCorpus).success, false);
  }
  const external = structuredClone(corpus);
  external.excerpts[0].source_url = 'https://example.com/paper.pdf';
  assert.equal(documentCorpusSchema.safeParse(external).success, false);
});

test('integridade rejeita trecho duplicado, tipo inconsistente e cobertura inflada', () => {
  const duplicate = structuredClone(corpus);
  duplicate.excerpts.push(duplicate.excerpts[0]);
  assert.throws(() => validateDocumentCorpus(duplicate, registry), /trecho inválida/);
  const wrongType = structuredClone(corpus);
  wrongType.excerpts[0].document_type = 'support_material';
  assert.throws(() => validateDocumentCorpus(wrongType, registry), /trecho inválida/);
  const inflated = structuredClone(corpus);
  inflated.coverage.pages_indexed += 1;
  assert.throws(() => validateDocumentCorpus(inflated, registry), /Cobertura documental inconsistente/);
});

test('passagens que atravessam páginas conservam proveniência adicional', () => {
  const lavicza = corpus.excerpts.find(({ id }) => id === 'article-lavicza');
  assert.equal(lavicza.page, 3);
  assert.equal(lavicza.additional_provenance[0].page, 2);
  const ongoing = corpus.excerpts.find(({ id }) => id === 'article-ongoing');
  assert.equal(ongoing.page, 3);
  assert.equal(ongoing.additional_provenance[0].page, 4);
  const autodesk = foundation.references.find(({ id }) => id === 'autodesk');
  assert.ok(autodesk.methodology_link.provenance.some(({ document_title, page }) => /Material de apoio/.test(document_title) && page === 4));
});

test('regressão conceitual: oferta às turmas continua planejada, piloto continua preparação documentada', () => {
  assert.equal(corpus.excerpts.find(({ id }) => id === 'article-application').status, 'planned');
  assert.equal(corpus.excerpts.find(({ id }) => id === 'article-pilot').status, 'documented');
  const application = method.sections.application.facts;
  assert.equal(application.find(({ id }) => id === 'application-classes-planned').status, 'planned');
  assert.deepEqual(application.filter(({ status }) => status === 'documented').map(({ id }) => id), ['application-pilot-completed']);
  const search = searchDocuments({ query: 'cinco turmas' }, corpus);
  assert.ok(search.results.length > 0);
  assert.ok(search.results.every(({ status }) => status === 'planned'));
});

test('regressão conceitual: expectativas de modelo, competências e interesse não viram resultados obtidos', () => {
  for (const id of ['article-expected-model', 'article-expected-skills', 'article-expected-interest']) {
    assert.equal(corpus.excerpts.find((excerpt) => excerpt.id === id).status, 'expected');
  }
  assert.equal(method.sections.analysis.facts.find(({ id }) => id === 'analysis-expected-not-measured').status, 'expected');
  assert.equal(method.sections.analysis.facts.find(({ id }) => id === 'analysis-pilot-qualitative').status, 'documented');
  assert.ok(method.not_verified.some(({ content }) => /não comprova aplicação concluída/.test(content)));
});

test('regressão conceitual: referências e atividades gerais do clube não são resultados de aplicação do minicurso', () => {
  for (const id of ['article-chang', 'article-evangelista', 'article-lavicza']) {
    const excerpt = corpus.excerpts.find((record) => record.id === id);
    assert.equal(excerpt.scope, 'third_party_reference');
    assert.equal(excerpt.status, 'context');
  }
  const club = corpus.excerpts.filter(({ scope }) => scope === 'club_activity');
  assert.ok(club.length > 0);
  assert.ok(club.every(({ status }) => status === 'context'));
  assert.doesNotMatch(JSON.stringify(method), /46[,.]4\s*%/);
});

test('Borke público conserva ordem do design, datas incompletas e diferença entre título e conclusão', () => {
  const journal = registry.documents.find(({ type }) => type === 'project_journal');
  assert.equal(journal.availability, 'available');
  assert.equal(journal.page_count, 11);
  assert.equal(journal.page_basis, 'canva_design_order');
  assert.ok(journal.notes.some(({ status, content }) => status === 'ambiguous' && /não comprova conclusão/.test(content)));
  assert.match(corpus.excerpts.find(({ id }) => id === 'journal-first-meeting').content, /ano não é informado/);
  assert.equal(corpus.excerpts.find(({ id }) => id === 'journal-fair-planning').section, null);
  assert.ok(corpus.excerpts.filter(({ document_type }) => document_type === 'project_journal').every(({ page }) => page <= 8));
});

test('divergências de público, quantidade de turmas e citação bibliográfica ficam explícitas', () => {
  assert.ok(method.ambiguities.some(({ id }) => id === 'ambiguity-audience'));
  assert.ok(method.ambiguities.some(({ id, content }) => id === 'ambiguity-classes' && /cinco turmas/.test(content) && /sete turmas/.test(content)));
  const conflict = foundation.ambiguities.find(({ id }) => id === 'evangelista-conflict');
  assert.ok(conflict);
  assert.match(conflict.content, /2021/);
  assert.match(conflict.content, /2026/);
  assert.match(conflict.content, /10\.26512\/2446-564X1112026/);
  assert.match(conflict.content, /10\.26512\/2446-564X2021e35946/);
});

test('busca documental usa todos os termos, aceita prefixos e não acrescenta metadados aos termos pesquisados', () => {
  assert.equal(searchDocuments({ query: 'extrusão termoimpossivelzx' }, corpus).match_count, 0);
  assert.equal(searchDocuments({ query: 'source_checked_at' }, corpus).match_count, 0);
  assert.equal(searchDocuments({ query: 'extrus' }, corpus).results[0].id, 'guide-tool-extrude');
  assert.equal(searchDocuments({ query: 'par' }, corpus).match_count, 0);
  assert.ok(searchDocuments({ query: 'o plano e o sketch' }, corpus).match_count > 0);
});

test('ranking é estável mesmo com a ordem física dos trechos invertida', () => {
  const result = searchDocuments({ query: 'modelagem', limit: 10 }, corpus);
  assert.deepEqual(searchDocuments({ query: 'modelagem', limit: 10 }, { ...corpus, excerpts: [...corpus.excerpts].reverse() }), result);
});

test('carregador documental rejeita nomes arbitrários e caminhos de arquivos', async () => {
  for (const name of ['../package.json', 'constructor', 'missing']) {
    await assert.rejects(loadDocumentDataset(name), /Conjunto documental desconhecido/);
  }
});
