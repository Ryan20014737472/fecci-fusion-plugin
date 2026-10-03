import { z } from 'zod';

export const OFFICIAL_SITE_URL = 'https://ryan20014737472.github.io/Fecci-fusion-360/';
const text = z.string().min(1);
// URI + pattern são palavras-chave padrão do JSON Schema anunciado pelo MCP.
const officialUrl = z.url().regex(/^https:\/\/ryan20014737472\.github\.io\/Fecci-fusion-360\//);
export const sourceSchema = z.strictObject({
  section: text,
  url: officialUrl,
});
const sources = z.array(sourceSchema).min(1);
const provenance = {
  source_checked_at: z.iso.date(),
  sources,
  verification_scope: text,
  not_published: z.array(text),
};
const sourcedText = z.strictObject({ title: text, content: text, sources });

export const teamSchema = z.strictObject({
  title: text,
  members: z.array(z.strictObject({ name: text, role: text, responsibilities: text, sources })).min(1),
  additional_public_roles: z.array(z.strictObject({ name: text, role: text, description: text, sources })),
  article_authorship: z.strictObject({ names: z.array(text).min(1), sources }),
  ...provenance,
});

export const referencesSchema = z.strictObject({
  title: text,
  bibliography: z.array(z.strictObject({
    title: text,
    authors: z.array(text).min(1),
    year: z.number().int().positive(),
    journal: text,
    volume: z.number().int().positive(),
    issue: z.number().int().positive(),
    pages: text,
    doi: text,
    doi_url: z.url(),
    pdf_url: officialUrl,
    citation_as_published: text,
    contribution: text,
    sources,
  })).min(1),
  additional_materials: z.array(z.strictObject({
    title: text,
    category: z.enum(['project_article', 'support_material', 'project_journal', 'software_link', 'site_repository']),
    url: z.url(),
    description: text,
    sources,
  })),
  ...provenance,
});

export const workshopSchema = z.strictObject({
  title: text,
  objective: text,
  educational_context: text,
  target_audience: text,
  duration_minutes: z.number().int().positive(),
  software: text,
  status: text,
  contents: z.array(z.strictObject({
    order: z.number().int().positive(), title: text, description: text, objective: text,
    content_or_material: text, sources,
  })).min(1),
  practical_activity: z.strictObject({ description: text, techniques: z.array(text).min(1), sources }),
  support_material: z.strictObject({
    title: text, format: z.literal('PDF'), pages: z.number().int().positive(),
    url: officialUrl, description: text,
    topics: z.array(text).min(1), sources,
  }),
  evaluation: sourcedText,
  continuity: text,
  ...provenance,
});

export const resultsSchema = z.strictObject({
  title: text,
  summary: text,
  obtained_results: z.array(sourcedText).min(1),
  prepared_instruments: z.array(sourcedText),
  pending_steps: z.array(sourcedText).min(1),
  project_goals_not_measured: z.array(sourcedText),
  quantitative_results: z.strictObject({ status: z.literal('not_published'), explanation: text, sources }),
  ...provenance,
});

export const timelineSchema = z.strictObject({
  title: text,
  chronology_basis: z.literal('published_sequence'),
  date_information: text,
  diary_status: text,
  diary_url: z.url(),
  events: z.array(z.strictObject({
    order: z.number().int().positive(), title: text, content: text,
    date: z.iso.date().nullable(), status: z.enum(['documented', 'planned']), sources,
  })).min(1),
  undated_unordered_records: z.array(z.strictObject({ title: text, content: text, date: z.null(), sources })),
  ...provenance,
});

export const searchOutputSchema = z.strictObject({
  query: text,
  match_count: z.number().int().nonnegative(),
  results: z.array(z.strictObject({
    id: text, title: text, content: text, source_checked_at: z.iso.date(), sources,
  })).max(10),
  message: text,
  source_checked_at: z.iso.date().describe('Data de verificação mais antiga da base consultada; cada resultado informa a data de seu conjunto.'),
  sources,
});
