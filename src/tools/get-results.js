import { loadDataset } from '../data/project-datasets.js';
import { resultsSchema } from '../data/project-schemas.js';
import { registerReadOnlyTool } from './read-only-tool.js';

export function registerGetResults(server, options = {}) {
  const load = options.loadDataset ?? loadDataset;
  return registerReadOnlyTool(server, {
    name: 'get_results', title: 'Resultados obtidos, evidências e etapas pendentes do FECCI',
    description: 'Distingue registros qualitativos já disponíveis, instrumentos preparados, objetivos e etapas pendentes. ' +
      'Informa que resultados quantitativos ainda não foram publicados e que conseguir turmas não comprova aplicação do curso. ' +
      'Não recebe argumentos. Inclui fontes e data de verificação.',
    outputSchema: resultsSchema, readData: () => load('results'),
  }, options);
}
