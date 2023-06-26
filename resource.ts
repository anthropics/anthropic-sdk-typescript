// File generated from our OpenAPI spec by Stainless.

import type { Anthropic } from './index';

export class APIResource {
  protected client: Anthropic;
  constructor(client: Anthropic) {
    this.client = client;

    this.get = client.get.bind(client);
    this.post = client.post.bind(client);
    this.patch = client.patch.bind(client);
    this.put = client.put.bind(client);
    this.delete = client.delete.bind(client);
    this.getAPIList = client.getAPIList.bind(client);
  }

  protected get: Anthropic['get'];
  protected post: Anthropic['post'];
  protected patch: Anthropic['patch'];
  protected put: Anthropic['put'];
  protected delete: Anthropic['delete'];
  protected getAPIList: Anthropic['getAPIList'];
}
