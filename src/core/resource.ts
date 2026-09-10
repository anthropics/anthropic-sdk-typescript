import { BaseAnthropic } from '../client';

export abstract class APIResource {
  protected _client: BaseAnthropic;

  constructor(client: BaseAnthropic) {
    this._client = client;
  }
}
