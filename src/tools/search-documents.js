import { z } from 'zod';
import { loadDocumentDataset } from '../data/document-datasets.js';
import { documentTypeSchema, searchDocumentsOutputSchema } from '../data/document-schemas.js';
import { queryTerms } from '../search/project-search.js';
import { searchDocuments } from '../search/document-search.js';
import { registerReadOnlyTool } from './read-only-tool.js';

export const searchDocumentsInputSchema = z.strictObject({
  query: z.string().trim().min(1).max(200)
    .refine((query) => queryTerms(query).length > 0, 'A consulta deve conter uma palavra ou número pesquisável.')
    .describe('Consulta textual em português de 1 a 200 caracteres; todos os termos significativos devem aparecer no mesmo trecho.'),
  document_type: documentTypeSchema.optional().describe('Tipo opcional de documento; PDFs bibliográficos inventariados não têm texto no corpus desta versão.'),
  limit: z.number().int().min(1).max(10).optional().describe('Quantidade máxima de resultados, entre 1 e 10; padrão 5.'),
});

export function registerSearchDocuments(server, options = {}) {
  const load = options.loadDocumentDataset ?? loadDocumentDataset;
  return registerReadOnlyTool(server, {
    name: 'search_documents', title: 'Pesquisar trechos dos documentos públicos FECCI',
    description: 'Busca exclusivamente no corpus local verificado do artigo do projeto, guia e texto público do Borke. ' +
      'Recebe query, document_type opcional e limit de 1 a 10. Ignora caixa e acentos, usa todos os termos e ranking lexical determinístico. ' +
      'Retorna trecho, documento, página/seção, URL direta, status, escopo e data. Não faz scraping, não inventa respostas e distingue expectativas de execução.',
    inputSchema: searchDocumentsInputSchema, outputSchema: searchDocumentsOutputSchema,
    readData: async (args) => searchDocuments(args, await load('corpus')),
  }, options);
}
