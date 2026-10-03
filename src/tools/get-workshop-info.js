import { loadDataset } from '../data/project-datasets.js';
import { workshopSchema } from '../data/project-schemas.js';
import { registerReadOnlyTool } from './read-only-tool.js';

export function registerGetWorkshopInfo(server, options = {}) {
  const load = options.loadDataset ?? loadDataset;
  return registerReadOnlyTool(server, {
    name: 'get_workshop_info', title: 'Minicurso FECCI: objetivos, conteúdo e material de apoio',
    description: 'Consulta objetivo, público, duração, etapas, modelagem de parafuso e porca, avaliação e guia PDF do minicurso. ' +
      'Explicita informações não publicadas no resumo do site. Não recebe argumentos. Inclui fontes e data de verificação.',
    outputSchema: workshopSchema, readData: () => load('workshop'),
  }, options);
}
