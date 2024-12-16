// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import * as Core from './core';
import Opuz from './opuz';

export class APIResource {
  protected _client: Core.APIClient;
  protected _opuz: Opuz;

  constructor(client: Core.APIClient) {
    this._client = client;
    this._opuz = new Opuz();
  }
}
