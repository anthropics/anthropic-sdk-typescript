import { APIResource } from '../../../../core/resource';
import * as GoogleAPI from './google/google';
import { Google } from './google/google';

export class Providers extends APIResource {
  google: GoogleAPI.Google = new GoogleAPI.Google(this._client);
}

Providers.Google = Google;

export declare namespace Providers {
  export { Google as Google };
}
