import { loadDocumentDataset } from '../data/document-datasets.js';
import { methodologySchema } from '../data/document-schemas.js';
import { registerReadOnlyTool } from './read-only-tool.js';

export function registerGetMethodology(server, options = {}) {
  const load = options.loadDocumentDataset ?? loadDocumentDataset;
  return registerReadOnlyTool(server, {
    name: 'get_methodology', title: 'Metodologia publicada do Projeto FECCI',
    description: 'Detalha planejamento, preparação, público, duração, aulas, prática, avaliação, aplicação, análise e limitações. ' +
      'Cada fato tem status e proveniência documental. Separa piloto realizado, aplicação planejada, resultados esperados e divergências entre fontes. ' +
      'Não recebe argumentos e não infere dados ausentes.',
    outputSchema: methodologySchema, readData: () => load('methodology'),
  }, options);
}
