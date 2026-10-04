import { queryTerms } from './project-search.js';

function normalize(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}

function wordScore(tokens, term, exact, prefix) {
  if (tokens.has(term)) return exact;
  return term.length >= 4 && [...tokens].some((token) => token.startsWith(term)) ? prefix : 0;
}

export function excerptProvenance(excerpt) {
  const { document_title, source_url, page, section, source_checked_at } = excerpt;
  return { document_title, source_url, page, section, source_checked_at };
}

export function searchDocuments({ query, document_type, limit = 5 }, corpus) {
  const terms = queryTerms(query);
  if (!terms.length) throw new Error('Consulta sem termos pesquisáveis.');
  const phrase = normalize(query);
  const matches = corpus.excerpts.filter((excerpt) => !document_type || excerpt.document_type === document_type)
    .flatMap((excerpt) => {
      // Ranking usa o trecho, sem acrescentar título do documento ou URL aos termos.
      const title = new Set(normalize(excerpt.title).match(/[\p{L}\p{N}]+/gu) ?? []);
      const content = new Set(normalize(excerpt.content).match(/[\p{L}\p{N}]+/gu) ?? []);
      const scores = terms.map((term) => wordScore(title, term, 8, 4) + wordScore(content, term, 2, 1));
      if (scores.some((score) => score === 0)) return [];
      const titleTerms = queryTerms(excerpt.title);
      const titleMatches = terms.filter((term) => wordScore(title, term, 1, 1) > 0).length;
      const specificity = Math.floor(32 * titleMatches / Math.max(1, titleTerms.length));
      const score = scores.reduce((sum, value) => sum + value, 0) +
        specificity + (normalize(excerpt.title).includes(phrase) ? 20 : 0) + (normalize(excerpt.content).includes(phrase) ? 5 : 0);
      return [{ excerpt, score }];
    }).sort((a, b) => b.score - a.score || (a.excerpt.id < b.excerpt.id ? -1 : a.excerpt.id > b.excerpt.id ? 1 : 0));
  return {
    query: query.trim(), document_type: document_type ?? null, limit, match_count: matches.length,
    results: matches.slice(0, limit).map(({ excerpt, score }, index) => ({ ...excerpt, rank: index + 1, score })),
    message: matches.length
      ? `${matches.length} trechos encontrados no corpus local; retornados até ${limit}, em ordem de relevância lexical.`
      : 'Nenhum trecho correspondente foi encontrado no corpus documental local verificado para esta consulta e filtro.',
    source_checked_at: corpus.source_checked_at, sources: corpus.sources,
  };
}
