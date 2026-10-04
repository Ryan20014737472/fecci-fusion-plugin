import { z } from 'zod';
import { loadSearchBase } from '../data/project-datasets.js';
import { loadDocumentDataset } from '../data/document-datasets.js';
import { searchOutputSchema } from '../data/project-schemas.js';
import { queryTerms, searchProject } from '../search/project-search.js';
import { projectDocumentRecords } from '../search/project-document-search.js';
import { registerReadOnlyTool } from './read-only-tool.js';

export const searchInputSchema = z.strictObject({
  query: z.string().trim().min(1).max(200)
    .refine((query) => queryTerms(query).length > 0, 'A consulta deve conter pelo menos uma palavra ou número pesquisável.')
    .describe('Consulta textual de 1 a 200 caracteres; termos significativos precisam aparecer no mesmo trecho.'),
});

export function registerSearchProject(server, options = {}) {
  const load = options.loadSearchBase ?? loadSearchBase;
  const loadDocuments = options.loadDocumentDataset ?? loadDocumentDataset;
  return registerReadOnlyTool(server, {
    name: 'search_project', title: 'Pesquisar a base pública local do Projeto FECCI',
    description: 'Pesquisa por query textual nos dados locais verificados de projeto, equipe, referências, minicurso, resultados e diário. ' +
      'Ignora caixa e acentos, exige todos os termos significativos no mesmo trecho e retorna até 10 resultados relevantes com título, conteúdo, fontes e data. ' +
      'Sem correspondência, retorna lista vazia e uma mensagem explícita. Não acessa a internet nem inventa respostas.',
    inputSchema: searchInputSchema, outputSchema: searchOutputSchema,
    readData: async ({ query }) => {
      const [base, corpus] = await Promise.all([load(), loadDocuments('corpus')]);
      return searchProject(query, base, projectDocumentRecords(corpus));
    },
  }, options);
}
