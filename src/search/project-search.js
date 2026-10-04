const STOP_WORDS = new Set('a as o os de da das do dos e em no na nos nas um uma uns umas para por com que qual quais quem como sobre ao aos se'.split(' '));

function normalize(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}

function words(value) {
  return normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function queryTerms(query) {
  return [...new Set(words(query).filter((word) => !STOP_WORDS.has(word)))];
}

function uniqueSources(sources) {
  return [...new Map(sources.map((source) => [source.url, source])).values()];
}

export function buildSearchDocuments(base) {
  const documents = [];
  function add(dataset, id, title, content, sources = dataset.sources) {
    documents.push({ id, title, content, sources, source_checked_at: dataset.source_checked_at });
  }
  const info = base.project_info;
  add(info, 'project-info', info.name, [
    info.title, info.description, `Edição: ${info.public_information.edition}.`,
    info.public_information.context, info.public_information.objective,
    `Áreas: ${info.areas.join(', ')}.`,
  ].join('\n'));

  const team = base.team;
  team.members.forEach((member, i) => add(team, `team-member-${i + 1}`, member.name,
    `${member.role}. ${member.responsibilities}`, member.sources));
  team.additional_public_roles.forEach((person, i) => add(team, `team-role-${i + 1}`, person.name,
    `${person.role}. ${person.description}`, person.sources));
  add(team, 'article-authorship', 'Autoria do artigo do projeto', team.article_authorship.names.join('; '), team.article_authorship.sources);

  const references = base.references;
  add(references, 'references-overview', references.title,
    `Referências bibliográficas usadas na fundamentação do projeto:\n${references.bibliography.map((ref) => ref.title).join('\n')}\nRecursos publicados: ${references.additional_materials.map((resource) => resource.title).join('; ')}.`);
  references.bibliography.forEach((ref, i) => add(references, `reference-${i + 1}`, ref.title,
    `${ref.citation_as_published}\nContribuição ao projeto: ${ref.contribution}`, ref.sources));
  references.additional_materials.forEach((resource, i) => add(references, `resource-${i + 1}`, resource.title,
    `${resource.description}\nRecurso publicado: ${resource.url}`, resource.sources));

  const workshop = base.workshop;
  add(workshop, 'workshop-info', workshop.title, [
    workshop.objective, workshop.educational_context, `Público: ${workshop.target_audience}.`,
    `Duração: ${workshop.duration_minutes} minutos.`, `Ferramenta: ${workshop.software}.`,
    `Status: ${workshop.status}.`, workshop.continuity,
  ].join('\n'));
  workshop.contents.forEach((item) => add(workshop, `workshop-content-${item.order}`, item.title,
    `${item.description}\nObjetivo: ${item.objective}\nConteúdo ou material: ${item.content_or_material}`, item.sources));
  add(workshop, 'workshop-practice', 'Atividade prática: parafuso e porca',
    `${workshop.practical_activity.description}\nTécnicas: ${workshop.practical_activity.techniques.join(', ')}.`, workshop.practical_activity.sources);
  add(workshop, 'workshop-material', workshop.support_material.title,
    `${workshop.support_material.description}\nPDF de ${workshop.support_material.pages} páginas.\nTemas: ${workshop.support_material.topics.join('; ')}.`, workshop.support_material.sources);
  add(workshop, 'workshop-evaluation', workshop.evaluation.title, workshop.evaluation.content, workshop.evaluation.sources);

  const results = base.results;
  add(results, 'results-status', results.title, `${results.summary}\n${results.quantitative_results.explanation}`);
  for (const [field, prefix, label] of [
    ['obtained_results', 'obtained', 'Registro já disponível'],
    ['prepared_instruments', 'prepared', 'Instrumento preparado'],
    ['pending_steps', 'pending', 'Etapa pendente'],
    ['project_goals_not_measured', 'goal', 'Objetivo sem mensuração publicada'],
  ]) {
    results[field].forEach((item, i) => add(results, `${prefix}-${i + 1}`, `${label}: ${item.title}`, item.content, item.sources));
  }

  const timeline = base.timeline;
  timeline.events.forEach((event) => add(timeline, `timeline-${event.order}`,
    `Etapa ${event.status === 'planned' ? 'prevista' : 'documentada'}: ${event.title}`,
    `${event.content}\n${event.date ? `Data publicada: ${event.date}.` : 'Data de calendário não publicada no resumo do diário.'}`, event.sources));
  timeline.undated_unordered_records.forEach((item, i) => add(timeline, `unordered-${i + 1}`,
    `Registro sem ordem cronológica confirmada: ${item.title}`, item.content, item.sources));

  for (const [name, dataset] of Object.entries(base)) {
    if (dataset.not_published?.length) {
      add(dataset, `not-published-${name}`, 'Informações não publicadas no resumo do site', dataset.not_published.join('\n'));
    }
  }
  return documents;
}

function wordScore(tokens, term, exactWeight, prefixWeight) {
  if (tokens.has(term)) return exactWeight;
  if (term.length >= 4 && [...tokens].some((token) => token.startsWith(term))) return prefixWeight;
  return 0;
}

export function searchProject(query, base, documentRecords = []) {
  const terms = queryTerms(query);
  if (!terms.length) throw new Error('Consulta sem termos pesquisáveis.');
  const legacyDocuments = buildSearchDocuments(base);
  const documents = [...legacyDocuments, ...documentRecords];
  const phrase = normalize(query);
  const matches = documents.flatMap((document, index) => {
    const titleTokens = new Set(words(document.title));
    const bodyTokens = new Set(words(document.content));
    const scores = terms.map((term) => wordScore(titleTokens, term, 8, 4) + wordScore(bodyTokens, term, 2, 1));
    if (scores.some((score) => score === 0)) return [];
    const score = scores.reduce((sum, value) => sum + value, 0) +
      (normalize(document.title).includes(phrase) ? 20 : 0) +
      (normalize(document.content).includes(phrase) ? 5 : 0);
    return [{ document, score, legacy: index < legacyDocuments.length }];
  }).sort((a, b) => b.score - a.score || Number(b.legacy) - Number(a.legacy) ||
    (a.document.id < b.document.id ? -1 : a.document.id > b.document.id ? 1 : 0));

  const datasets = Object.values(base);
  return {
    query: query.trim(),
    match_count: matches.length,
    results: matches.slice(0, 10).map(({ document }) => document),
    message: matches.length
      ? `Foram encontrados ${matches.length} trechos na base pública local; são retornados até 10, em ordem de relevância.`
      : 'Nenhuma informação correspondente à consulta foi encontrada na base pública local verificada.',
    source_checked_at: [...datasets, ...documentRecords].map((dataset) => dataset.source_checked_at).sort()[0],
    sources: uniqueSources([...datasets, ...documentRecords].flatMap((dataset) => dataset.sources)),
  };
}
