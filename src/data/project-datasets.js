import { readFile } from 'node:fs/promises';
import { getProjectInfo } from './project-info.js';
import { teamSchema, referencesSchema, workshopSchema, resultsSchema, timelineSchema } from './project-schemas.js';

const datasets = {
  team: { file: 'team.json', schema: teamSchema },
  references: { file: 'references.json', schema: referencesSchema },
  workshop: { file: 'workshop-info.json', schema: workshopSchema },
  results: { file: 'results.json', schema: resultsSchema },
  timeline: { file: 'project-timeline.json', schema: timelineSchema },
};

export async function loadDataset(name) {
  if (!Object.hasOwn(datasets, name)) throw new Error('Conjunto de dados desconhecido.');
  const { file, schema } = datasets[name];
  const raw = await readFile(new URL(`../../data/${file}`, import.meta.url), 'utf8');
  return schema.parse(JSON.parse(raw));
}

export async function loadSearchBase() {
  const names = Object.keys(datasets);
  const values = await Promise.all([getProjectInfo(), ...names.map(loadDataset)]);
  return Object.fromEntries(['project_info', ...names].map((name, index) => [name, values[index]]));
}
