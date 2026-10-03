import { registerGetProjectInfo } from './get-project-info.js';
import { registerSearchProject } from './search-project.js';
import { registerGetTeam } from './get-team.js';
import { registerGetReferences } from './get-references.js';
import { registerGetWorkshopInfo } from './get-workshop-info.js';
import { registerGetResults } from './get-results.js';
import { registerGetProjectTimeline } from './get-project-timeline.js';

export function registerTools(server, options = {}) {
  registerGetProjectInfo(server, options);
  registerSearchProject(server, options);
  registerGetTeam(server, options);
  registerGetReferences(server, options);
  registerGetWorkshopInfo(server, options);
  registerGetResults(server, options);
  registerGetProjectTimeline(server, options);
}
