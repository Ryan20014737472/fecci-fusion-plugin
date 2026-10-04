import { z } from 'zod';

const text = z.string().min(1);
const id = z.string().regex(/^[a-z0-9-]+$/);
const publicUrl = z.url().regex(/^https:\/\/(?:ryan20014737472\.github\.io\/Fecci-fusion-360\/|canva\.link\/ino42l26d4v7d6u(?:$|[?#]))/);
export const documentTypeSchema = z.enum(['project_article', 'support_material', 'project_journal', 'bibliographic_reference']);
export const semanticStatusSchema = z.enum(['documented', 'planned', 'expected', 'context', 'ambiguous', 'not_published']);
export const documentProvenanceSchema = z.strictObject({
  document_title: text,
  source_url: publicUrl,
  page: z.number().int().positive().nullable(),
  section: text.nullable(),
  source_checked_at: z.iso.date(),
});
const provenance = z.array(documentProvenanceSchema).min(1);
export const documentFactSchema = z.strictObject({
  id, content: text, status: semanticStatusSchema, provenance,
});
const metadata = {
  schema_version: z.literal(1), title: text, source_checked_at: z.iso.date(),
  sources: provenance, verification_scope: text,
  not_verified: z.array(documentFactSchema),
};

export const documentsSchema = z.strictObject({
  ...metadata,
  documents: z.array(z.strictObject({
    id, title: text, type: documentTypeSchema, description: text, url: publicUrl,
    page_count: z.number().int().positive().nullable(),
    page_basis: z.enum(['pdf_order', 'canva_design_order']),
    source_checked_at: z.iso.date(),
    availability: z.enum(['available', 'not_verifiable']),
    verification_method: z.enum(['pdf_text_and_visual_review', 'pdf_metadata', 'public_canva_text']),
    corpus_included: z.boolean(),
    content_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    checksum_kind: z.enum(['pdf_bytes', 'extracted_canva_text']).nullable(),
    sources: provenance, notes: z.array(documentFactSchema),
  })).min(1),
});

export const documentExcerptSchema = z.strictObject({
  id, title: text, content: text, document_id: id, document_type: documentTypeSchema,
  document_title: text, source_url: publicUrl,
  page: z.number().int().positive().nullable(), section: text.nullable(),
  source_checked_at: z.iso.date(), status: semanticStatusSchema,
  additional_provenance: z.array(documentProvenanceSchema),
  scope: z.enum(['project', 'workshop_material', 'club_activity', 'third_party_reference']),
  extraction_method: z.enum(['pdf_text', 'visual_table', 'public_canva_text']),
});
export const documentCorpusSchema = z.strictObject({
  ...metadata,
  excerpts: z.array(documentExcerptSchema).min(1),
  coverage: z.strictObject({
    documents_indexed: z.number().int().positive(),
    pages_indexed: z.number().int().positive(),
    excerpt_count: z.number().int().positive(),
  }),
});

const methodSection = z.strictObject({ title: text, facts: z.array(documentFactSchema).min(1) });
export const methodologySchema = z.strictObject({
  ...metadata,
  sections: z.strictObject({
    planning: methodSection, preparation: methodSection, target_audience: methodSection,
    duration: methodSection, lesson_organization: methodSection, practical_activities: methodSection,
    evaluation_instruments: methodSection, application: methodSection, analysis: methodSection,
    limitations: methodSection,
  }),
  ambiguities: z.array(documentFactSchema),
});

export const theoreticalFoundationSchema = z.strictObject({
  ...metadata,
  references: z.array(z.strictObject({
    id, authors: z.array(text).min(1), year: z.number().int().positive().nullable(),
    year_basis: text, work: text, concept_used: documentFactSchema,
    contribution: documentFactSchema, methodology_link: documentFactSchema,
    sources: provenance,
    citation_variants: z.array(z.strictObject({
      context: text, year: z.number().int().positive().nullable(), citation: text, provenance,
    })).min(1),
    notes: z.array(documentFactSchema),
  })).min(1),
  ambiguities: z.array(documentFactSchema),
});

export const searchDocumentsOutputSchema = z.strictObject({
  query: text, document_type: documentTypeSchema.nullable(),
  limit: z.number().int().min(1).max(10), match_count: z.number().int().nonnegative(),
  results: z.array(documentExcerptSchema.extend({
    rank: z.number().int().positive(), score: z.number().int().positive(),
  })).max(10),
  message: text, source_checked_at: z.iso.date(), sources: provenance,
});
