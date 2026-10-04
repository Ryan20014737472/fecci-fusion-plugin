import { loadDocumentDataset } from '../data/document-datasets.js';
import { theoreticalFoundationSchema } from '../data/document-schemas.js';
import { registerReadOnlyTool } from './read-only-tool.js';

export function registerGetTheoreticalFoundation(server, options = {}) {
  const load = options.loadDocumentDataset ?? loadDocumentDataset;
  return registerReadOnlyTool(server, {
    name: 'get_theoretical_foundation', title: 'Fundamentação teórica publicada do Projeto FECCI',
    description: 'Consulta as seis referências usadas no artigo, com autores e ano citados, trabalho, conceitos, contribuição e vínculo metodológico publicado. ' +
      'Inclui páginas/fontes, variantes bibliográficas e vínculos não publicados. Distingue estudos de terceiros dos resultados do FECCI. Não recebe argumentos.',
    outputSchema: theoreticalFoundationSchema, readData: () => load('foundation'),
  }, options);
}
