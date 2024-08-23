import * as Core from '@anthropic-ai/sdk/core'
import * as Resources from '@anthropic-ai/sdk/resources/index'
import * as API from '@anthropic-ai/sdk/index'
import { type RequestInit } from '@anthropic-ai/sdk/_shims/index'
import { authenticate } from './utils/authenticate'

const DEFAULT_VERSION = 'vertex-2023-10-16'

export type ClientOptions = Omit<API.ClientOptions, 'apiKey' | 'authToken'> & {
  region?: string | null | undefined
  projectId?: string | null | undefined
  accessToken?: string | null | undefined
  clientEmail?: string | null | undefined
  privateKey?: string | null | undefined
}

export class AnthropicVertexWeb extends Core.APIClient {
  region: string
  projectId: string | null
  accessToken: string | null

  private _options: ClientOptions

  constructor({
    baseURL = Core.readEnv('ANTHROPIC_VERTEX_BASE_URL'),
    region = Core.readEnv('CLOUD_ML_REGION') ?? null,
    projectId = Core.readEnv('ANTHROPIC_VERTEX_PROJECT_ID') ?? null,
    accessToken = Core.readEnv('ANTHROPIC_VERTEX_ACCESS_TOKEN') ?? null,
    clientEmail = Core.readEnv('ANTHROPIC_VERTEX_CLIENT_EMAIL') ?? null,
    privateKey = Core.readEnv('ANTHROPIC_VERTEX_PRIVATE_KEY') ?? null,
    ...opts
  }: ClientOptions = {}) {
    if (!region) {
      throw new Error(
        'No region was given. The client should be instantiated with the `region` option or the `CLOUD_ML_REGION` environment variable should be set.',
      )
    }

    const options: ClientOptions = {
      ...opts,
      baseURL: baseURL || `https://${region}-aiplatform.googleapis.com/v1`,
      clientEmail,
      privateKey,
    }

    super({
      baseURL: options.baseURL!,
      timeout: options.timeout ?? 600000 /* 10 minutes */,
      httpAgent: options.httpAgent,
      maxRetries: options.maxRetries,
      fetch: options.fetch,
    })
    this._options = options

    this.region = region
    this.projectId = projectId
    this.accessToken = accessToken
  }

  messages: Resources.Messages = new Resources.Messages(this)

  protected override defaultQuery(): Core.DefaultQuery | undefined {
    return this._options.defaultQuery
  }

  protected override defaultHeaders(
    opts: Core.FinalRequestOptions,
  ): Core.Headers {
    return {
      ...super.defaultHeaders(opts),
      ...this._options.defaultHeaders,
    }
  }

  protected override async prepareOptions(
    options: Core.FinalRequestOptions,
  ): Promise<void> {
    if (!this.accessToken) {
      if (!this._options.clientEmail || !this._options.privateKey) {
        throw new Error(
          'No clientEmail or privateKey was provided. Set it in the constructor or use the ANTHROPIC_VERTEX_CLIENT_EMAIL and ANTHROPIC_VERTEX_PRIVATE_KEY environment variables.',
        )
      }
      this.accessToken = (
        await authenticate({
          clientEmail: this._options.clientEmail,
          privateKey: this._options.privateKey,
        })
      ).access_token
    }

    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${this.accessToken}`,
      'x-goog-user-project': this.projectId,
    }
  }

  override buildRequest(options: Core.FinalRequestOptions<unknown>): {
    req: RequestInit
    url: string
    timeout: number
  } {
    if (Core.isObj(options.body)) {
      if (!options.body['anthropic_version']) {
        options.body['anthropic_version'] = DEFAULT_VERSION
      }
    }

    if (options.path === '/v1/messages' && options.method === 'post') {
      if (!this.projectId) {
        throw new Error(
          'No projectId was given and it could not be resolved from credentials. The client should be instantiated with the `projectId` option or the `ANTHROPIC_VERTEX_PROJECT_ID` environment variable should be set.',
        )
      }

      if (!Core.isObj(options.body)) {
        throw new Error(
          'Expected request body to be an object for post /v1/messages',
        )
      }

      const model = options.body['model']
      options.body['model'] = undefined

      const stream = options.body['stream'] ?? false

      const specifier = stream ? 'streamRawPredict' : 'rawPredict'

      options.path = `/projects/${this.projectId}/locations/${this.region}/publishers/anthropic/models/${model}:${specifier}`
    }

    return super.buildRequest(options)
  }
}
