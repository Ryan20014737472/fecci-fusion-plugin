import { loadDataset } from '../data/project-datasets.js';
import { teamSchema } from '../data/project-schemas.js';
import { registerReadOnlyTool } from './read-only-tool.js';

export function registerGetTeam(server, options = {}) {
  const load = options.loadDataset ?? loadDataset;
  return registerReadOnlyTool(server, {
    name: 'get_team', title: 'Equipe e papéis públicos do Projeto FECCI',
    description: 'Consulta participantes, responsabilidades, orientação e mentoria publicados no site. ' +
      'Preserva separadamente os nomes exibidos na equipe e a autoria do artigo. Não recebe argumentos. Inclui fontes e data de verificação.',
    outputSchema: teamSchema, readData: () => load('team'),
  }, options);
}
