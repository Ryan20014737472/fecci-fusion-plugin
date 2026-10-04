import { loadDocumentDataset } from '../data/document-datasets.js';
import { documentsSchema } from '../data/document-schemas.js';
import { registerReadOnlyTool } from './read-only-tool.js';

export function registerGetProjectDocuments(server, options = {}) {
  const load = options.loadDocumentDataset ?? loadDocumentDataset;
  return registerReadOnlyTool(server, {
    name: 'get_project_documents', title: 'Documentos públicos do Projeto FECCI',
    description: 'Lista artigo, material de apoio, Borke e PDFs bibliográficos vinculados no site, com tipo, descrição, URL, páginas, disponibilidade verificada e data. ' +
      'Indica quais documentos têm trechos no corpus e as limitações do Canva. Não recebe argumentos e não consulta documentos em tempo real.',
    outputSchema: documentsSchema, readData: () => load('documents'),
  }, options);
}
