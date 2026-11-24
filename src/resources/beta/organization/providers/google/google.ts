import { APIResource } from '../../../../../core/resource';
import * as ProjectsAPI from './projects/projects';
import { Projects } from './projects/projects';

export class Google extends APIResource {
  projects: ProjectsAPI.Projects = new ProjectsAPI.Projects(this._client);
}

Google.Projects = Projects;

export declare namespace Google {
  export { Projects as Projects };
}
