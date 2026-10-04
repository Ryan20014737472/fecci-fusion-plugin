import { OFFICIAL_SITE_URL } from '../data/project-schemas.js';
import { excerptProvenance } from './document-search.js';

const labels = {
  documented: 'Registro documentado', planned: 'Proposta ou etapa planejada',
  expected: 'Resultado esperado', context: 'Contexto publicado',
  ambiguous: 'Informação com divergência publicada', not_published: 'Informação não publicada',
};

export function projectDocumentRecords(corpus) {
  return corpus.excerpts.map((excerpt) => {
    const provenance = [excerptProvenance(excerpt), ...excerpt.additional_provenance];
    const sources = provenance.map((source) => ({
      section: `${source.document_title}; página ${source.page ?? 'não informada'}; seção ${source.section ?? 'não identificada'}`,
      // O schema V2 só admite URLs do site. O link direto do Canva fica em content.
      url: source.source_url.startsWith(OFFICIAL_SITE_URL)
        ? `${source.source_url}${source.page === null ? '' : `#page=${source.page}`}`
        : `${OFFICIAL_SITE_URL}#diario`,
    }));
    return {
      id: `document-${excerpt.id}`, title: `${excerpt.title} — ${excerpt.document_title}`,
      content: [excerpt.content, `Natureza: ${labels[excerpt.status]}. Escopo: ${excerpt.scope}.`,
        ...provenance.map((source) => `Documento: ${source.document_title}. Página: ${source.page ?? 'não informada'}. Seção: ${source.section ?? 'não identificada'}. URL: ${source.source_url}`),
      ].join('\n'),
      source_checked_at: excerpt.source_checked_at, sources,
    };
  });
}
