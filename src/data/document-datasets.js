import { readFile } from 'node:fs/promises';
import { OFFICIAL_SITE_URL } from './project-schemas.js';
import { documentsSchema, documentCorpusSchema, methodologySchema, theoreticalFoundationSchema } from './document-schemas.js';

const datasets = {
  documents: { file: 'documents.json', schema: documentsSchema },
  corpus: { file: 'document-corpus.json', schema: documentCorpusSchema },
  methodology: { file: 'methodology.json', schema: methodologySchema },
  foundation: { file: 'theoretical-foundation.json', schema: theoreticalFoundationSchema },
};

async function readDataset(name) {
  const { file, schema } = datasets[name];
  return schema.parse(JSON.parse(await readFile(new URL(`../../data/${file}`, import.meta.url), 'utf8')));
}

export function validateDocumentProvenance(data, registry) {
  const documents = new Map(registry.documents.map((document) => [document.url, document]));
  const website = new URL(OFFICIAL_SITE_URL);
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(value, 'source_url')) {
      const source = new URL(value.source_url);
      if (source.origin === website.origin && source.pathname === website.pathname) {
        if (value.page !== null || value.document_title !== 'Projeto FECCI — site oficial') throw new Error('Proveniência HTML inválida.');
      } else {
        const document = documents.get(value.source_url);
        if (!document || value.document_title !== document.title || value.source_checked_at !== document.source_checked_at ||
            (value.page !== null && (document.page_count === null || value.page > document.page_count))) {
          throw new Error('Proveniência documental inválida.');
        }
      }
    }
    Object.values(value).forEach(visit);
  }
  visit(data);
}

export function validateDocumentCorpus(corpus, registry) {
  validateDocumentProvenance(corpus, registry);
  const seen = new Set();
  const pages = new Set();
  const documents = new Set();
  for (const excerpt of corpus.excerpts) {
    const document = registry.documents.find(({ id }) => id === excerpt.document_id);
    if (seen.has(excerpt.id) || !document?.corpus_included || document.availability !== 'available' ||
        excerpt.document_type !== document.type || excerpt.source_url !== document.url) {
      throw new Error('Referência de trecho inválida.');
    }
    seen.add(excerpt.id);
    documents.add(document.id);
    if (excerpt.page !== null) pages.add(`${document.id}:${excerpt.page}`);
  }
  if (corpus.coverage.excerpt_count !== seen.size || corpus.coverage.pages_indexed !== pages.size ||
      corpus.coverage.documents_indexed !== documents.size) throw new Error('Cobertura documental inconsistente.');
}

export async function loadDocumentDataset(name) {
  if (!Object.hasOwn(datasets, name)) throw new Error('Conjunto documental desconhecido.');
  const data = await readDataset(name);
  const registry = name === 'documents' ? data : await readDataset('documents');
  validateDocumentProvenance(data, registry);
  if (name === 'corpus') validateDocumentCorpus(data, registry);
  return data;
}
