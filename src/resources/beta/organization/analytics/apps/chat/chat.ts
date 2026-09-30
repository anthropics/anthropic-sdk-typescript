import { APIResource } from '../../../../../../core/resource';
import * as ProjectsAPI from './projects';
import { ProjectListParams, Projects } from './projects';

export class Chat extends APIResource {
  projects: ProjectsAPI.Projects = new ProjectsAPI.Projects(this._client);
}

Chat.Projects = Projects;

export declare namespace Chat {
  export { Projects as Projects, type ProjectListParams as ProjectListParams };
}
