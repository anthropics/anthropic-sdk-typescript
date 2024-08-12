// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as PromptCachingAPI from './prompt-caching/prompt-caching';

export class Beta extends APIResource {
  promptCaching: PromptCachingAPI.PromptCaching = new PromptCachingAPI.PromptCaching(this._client);
}

export namespace Beta {
  export import PromptCaching = PromptCachingAPI.PromptCaching;
}
