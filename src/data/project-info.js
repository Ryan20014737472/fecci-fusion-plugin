import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const text = z.string().min(1);
const url = z.url();

export const projectInfoSchema = z.strictObject({
  name: text.describe('Nome exibido no site oficial.'),
  title: text.describe('Título completo do projeto no site.'),
  description: text,
  areas: z.array(text).min(1),
  official_site_url: url,
  public_information: z.strictObject({
    edition: z.number().int(),
    context: text,
    objective: text,
    workshop: z.strictObject({
      duration_minutes: z.number().int().positive(),
      target_audience: text,
      status: text,
      software: text,
      practical_activity: text,
      topics: z.array(text).min(1),
    }),
    support_material: z.strictObject({
      description: text,
      url,
    }),
    results: z.strictObject({
      completed_stage: text,
      available_evidence: text,
      quantitative_results_status: text,
      next_stage: text,
    }),
  }),
  source_checked_at: z.iso.date().describe('Data da verificação do site; não é uma consulta em tempo real.'),
  sources: z.array(z.strictObject({ section: text, url })).min(1),
});

export async function getProjectInfo() {
  const file = new URL('../../data/project-info.json', import.meta.url);
  const raw = await readFile(file, 'utf8');
  return projectInfoSchema.parse(JSON.parse(raw));
}
