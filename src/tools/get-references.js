import { loadDataset } from '../data/project-datasets.js';
import { referencesSchema } from '../data/project-schemas.js';
import { registerReadOnlyTool } from './read-only-tool.js';

export function registerGetReferences(server, options = {}) {
  const load = options.loadDataset ?? loadDataset;
  return registerReadOnlyTool(server, {
    name: 'get_references', title: 'Referências bibliográficas e materiais do Projeto FECCI',
    description: 'Retorna as três referências teóricas com autoria, ano, periódico, DOI e PDF como publicados no site, ' +
      'além dos links do artigo do projeto, guia, diário e recursos. Não consulta links externos nem recebe argumentos. Inclui fontes e data de verificação.',
    outputSchema: referencesSchema, readData: () => load('references'),
  }, options);
}
