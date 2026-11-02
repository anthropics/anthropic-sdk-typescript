import { APIResource } from '../../../core/resource';
import * as BetaAPI from '../beta';
import { APIPromise } from '../../../core/api-promise';
import { Page, type PageParams, PagePromise } from '../../../core/pagination';
import { buildHeaders } from '../../../internal/headers';
import { RequestOptions } from '../../../internal/request-options';
import { startApiCallSpan } from '../../../internal/tracing';
import { path } from '../../../internal/utils/path';

export class Webhooks extends APIResource {
  /**
   * Create an organization webhook endpoint.
   *
   * An organization webhook endpoint belongs to the organization rather than to one
   * of its workspaces. An organization can have at most 32 organization webhook
   * endpoints, enabled or disabled.
   *
   * The response includes the endpoint's signing secret. No read returns it, so
   * store it when you receive it.
   *
   * Every request must include the beta header
   * `anthropic-beta: webhooks-2026-10-07`. A request without it returns `404`,
   * exactly as if this API did not exist. Anthropic turns organization webhook
   * endpoints on for each organization; until yours is on, requests also return
   * `404`. Organization webhook endpoints are in beta and are not available to
   * organizations with HIPAA readiness enabled.
   *
   * @example
   * ```ts
   * const betaNewOrganizationWebhookEndpoint =
   *   await client.beta.organization.webhooks.create({
   *     enabled_events: [
   *       'user_profile.enforcement_action_opened',
   *     ],
   *     url: 'x',
   *   });
   * ```
   */
  create(
    params: WebhookCreateParams,
    options?: RequestOptions,
  ): APIPromise<BetaNewOrganizationWebhookEndpoint> {
    const { betas, ...body } = params;
    return this._client.post('/v1/organizations/webhooks', {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'webhooks-2026-10-07'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.webhooks.create', options, {
        route: '/v1/organizations/webhooks',
        createdIDAttribute: 'anthropic.organization.webhook.id',
      }),
    });
  }

  /**
   * Retrieve an organization webhook endpoint by ID.
   *
   * Every request must include the beta header
   * `anthropic-beta: webhooks-2026-10-07`. A request without it returns `404`,
   * exactly as if this API did not exist. Anthropic turns organization webhook
   * endpoints on for each organization; until yours is on, requests also return
   * `404`. Organization webhook endpoints are in beta and are not available to
   * organizations with HIPAA readiness enabled.
   *
   * @example
   * ```ts
   * const betaOrganizationWebhookEndpoint =
   *   await client.beta.organization.webhooks.retrieve(
   *     'webhook_endpoint_id',
   *   );
   * ```
   */
  retrieve(
    webhookEndpointID: string,
    params: WebhookRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaOrganizationWebhookEndpoint> {
    const { betas } = params ?? {};
    return this._client.get(path`/v1/organizations/webhooks/${webhookEndpointID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'webhooks-2026-10-07'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.webhooks.retrieve', options, {
        route: '/v1/organizations/webhooks/{webhook_endpoint_id}',
        attributes: { 'anthropic.organization.webhook.id': webhookEndpointID },
      }),
    });
  }

  /**
   * Update an organization webhook endpoint. Only the fields you send are changed.
   *
   * Every request must include the beta header
   * `anthropic-beta: webhooks-2026-10-07`. A request without it returns `404`,
   * exactly as if this API did not exist. Anthropic turns organization webhook
   * endpoints on for each organization; until yours is on, requests also return
   * `404`. Organization webhook endpoints are in beta and are not available to
   * organizations with HIPAA readiness enabled.
   *
   * @example
   * ```ts
   * const betaOrganizationWebhookEndpoint =
   *   await client.beta.organization.webhooks.update(
   *     'webhook_endpoint_id',
   *   );
   * ```
   */
  update(
    webhookEndpointID: string,
    params: WebhookUpdateParams,
    options?: RequestOptions,
  ): APIPromise<BetaOrganizationWebhookEndpoint> {
    const { betas, ...body } = params;
    return this._client.post(path`/v1/organizations/webhooks/${webhookEndpointID}`, {
      body,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'webhooks-2026-10-07'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.webhooks.update', options, {
        route: '/v1/organizations/webhooks/{webhook_endpoint_id}',
        attributes: { 'anthropic.organization.webhook.id': webhookEndpointID },
      }),
    });
  }

  /**
   * List the organization's webhook endpoints.
   *
   * An organization webhook endpoint belongs to the organization rather than to one
   * of its workspaces. The list does not include webhook endpoints that belong to a
   * workspace.
   *
   * Every request must include the beta header
   * `anthropic-beta: webhooks-2026-10-07`. A request without it returns `404`,
   * exactly as if this API did not exist. Anthropic turns organization webhook
   * endpoints on for each organization; until yours is on, requests also return
   * `404`. Organization webhook endpoints are in beta and are not available to
   * organizations with HIPAA readiness enabled.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaOrganizationWebhookEndpoint of client.beta.organization.webhooks.list()) {
   *   // ...
   * }
   * ```
   */
  list(
    params: WebhookListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<BetaOrganizationWebhookEndpointsPage, BetaOrganizationWebhookEndpoint> {
    const { betas, ...query } = params ?? {};
    return this._client.getAPIList('/v1/organizations/webhooks', Page<BetaOrganizationWebhookEndpoint>, {
      query,
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'webhooks-2026-10-07'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.webhooks.list', options, {
        route: '/v1/organizations/webhooks',
        queryParams: ['after_id', 'before_id', 'limit', 'order'],
      }),
    });
  }

  /**
   * Delete an organization webhook endpoint.
   *
   * Every request must include the beta header
   * `anthropic-beta: webhooks-2026-10-07`. A request without it returns `404`,
   * exactly as if this API did not exist. Anthropic turns organization webhook
   * endpoints on for each organization; until yours is on, requests also return
   * `404`. Organization webhook endpoints are in beta and are not available to
   * organizations with HIPAA readiness enabled.
   *
   * @example
   * ```ts
   * const betaDeletedOrganizationWebhookEndpoint =
   *   await client.beta.organization.webhooks.delete(
   *     'webhook_endpoint_id',
   *   );
   * ```
   */
  delete(
    webhookEndpointID: string,
    params: WebhookDeleteParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaDeletedOrganizationWebhookEndpoint> {
    const { betas } = params ?? {};
    return this._client.delete(path`/v1/organizations/webhooks/${webhookEndpointID}`, {
      ...options,
      headers: buildHeaders([
        { 'anthropic-beta': [...(betas ?? []), 'webhooks-2026-10-07'].toString() },
        options?.headers,
      ]),
      __qualifiers: { beta: 'true' },
      __span: startApiCallSpan(this._client, 'anthropic.organization.webhooks.delete', options, {
        route: '/v1/organizations/webhooks/{webhook_endpoint_id}',
        attributes: { 'anthropic.organization.webhook.id': webhookEndpointID },
      }),
    });
  }

  /**
   * Replace an organization webhook endpoint's signing secret. The old secret stops
   * working immediately. The new secret is returned only in this response.
   *
   * Every request must include the beta header
   * `anthropic-beta: webhooks-2026-10-07`. A request without it returns `404`,
   * exactly as if this API did not exist. Anthropic turns organization webhook
   * endpoints on for each organization; until yours is on, requests also return
   * `404`. Organization webhook endpoints are in beta and are not available to
   * organizations with HIPAA readiness enabled.
   *
   * @example
   * ```ts
   * const betaOrganizationWebhookEndpointSigningSecret =
   *   await client.beta.organization.webhooks.regenerateSigningSecret(
   *     'webhook_endpoint_id',
   *   );
   * ```
   */
  regenerateSigningSecret(
    webhookEndpointID: string,
    params: WebhookRegenerateSigningSecretParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<BetaOrganizationWebhookEndpointSigningSecret> {
    const { betas } = params ?? {};
    return this._client.post(
      path`/v1/organizations/webhooks/${webhookEndpointID}/regenerate_signing_secret`,
      {
        ...options,
        headers: buildHeaders([
          { 'anthropic-beta': [...(betas ?? []), 'webhooks-2026-10-07'].toString() },
          options?.headers,
        ]),
        __qualifiers: { beta: 'true' },
        __span: startApiCallSpan(
          this._client,
          'anthropic.organization.webhooks.regenerate_signing_secret',
          options,
          {
            route: '/v1/organizations/webhooks/{webhook_endpoint_id}/regenerate_signing_secret',
            attributes: { 'anthropic.organization.webhook.id': webhookEndpointID },
          },
        ),
      },
    );
  }
}

export type BetaOrganizationWebhookEndpointsPage = Page<BetaOrganizationWebhookEndpoint>;

/**
 * A deleted organization webhook endpoint.
 */
export interface BetaDeletedOrganizationWebhookEndpoint {
  /**
   * ID of the deleted webhook endpoint.
   */
  id: string;

  /**
   * Always `webhook_endpoint_deleted`.
   */
  type: 'webhook_endpoint_deleted';
}

/**
 * A new organization webhook endpoint, with its signing secret.
 */
export interface BetaNewOrganizationWebhookEndpoint {
  /**
   * ID of the webhook endpoint.
   */
  id: string;

  /**
   * When the endpoint was created, in RFC 3339 format.
   */
  created_at: string;

  /**
   * Notes about the endpoint. An empty string when none were given.
   */
  description: string;

  /**
   * Why Anthropic disabled the endpoint automatically. An empty string when the
   * endpoint is enabled, or when you disabled it.
   */
  disabled_reason: string;

  /**
   * The event types delivered to the endpoint.
   */
  enabled_events: Array<
    'user_profile.enforcement_action_opened' | 'user_profile.enforcement_action_resolved'
  >;

  /**
   * A short label for the endpoint. An empty string when none was given.
   */
  name: string;

  /**
   * The secret Anthropic signs deliveries to the endpoint with (prefix `whsec_`). No
   * other response returns it, so store it now. To replace it, regenerate the
   * signing secret.
   */
  signing_secret: string;

  /**
   * Whether deliveries are sent to the endpoint.
   */
  state: BetaOrganizationWebhookEndpointState;

  /**
   * When the endpoint was last changed, in RFC 3339 format.
   */
  updated_at: string;

  /**
   * The HTTPS URL that deliveries are sent to.
   */
  url: string;
}

/**
 * A webhook endpoint that belongs to the organization rather than to one of its
 * workspaces.
 */
export interface BetaOrganizationWebhookEndpoint {
  /**
   * ID of the webhook endpoint.
   */
  id: string;

  /**
   * When the endpoint was created, in RFC 3339 format.
   */
  created_at: string;

  /**
   * Notes about the endpoint. An empty string when none were given.
   */
  description: string;

  /**
   * Why Anthropic disabled the endpoint automatically. An empty string when the
   * endpoint is enabled, or when you disabled it.
   */
  disabled_reason: string;

  /**
   * The event types delivered to the endpoint.
   */
  enabled_events: Array<
    'user_profile.enforcement_action_opened' | 'user_profile.enforcement_action_resolved'
  >;

  /**
   * A short label for the endpoint. An empty string when none was given.
   */
  name: string;

  /**
   * Whether deliveries are sent to the endpoint.
   */
  state: BetaOrganizationWebhookEndpointState;

  /**
   * When the endpoint was last changed, in RFC 3339 format.
   */
  updated_at: string;

  /**
   * The HTTPS URL that deliveries are sent to.
   */
  url: string;
}

/**
 * An organization webhook endpoint's new signing secret.
 */
export interface BetaOrganizationWebhookEndpointSigningSecret {
  /**
   * The new signing secret. Deliveries are signed with it from now on, and no other
   * response returns it.
   */
  signing_secret: string;
}

/**
 * Whether deliveries are sent to an organization webhook endpoint.
 */
export type BetaOrganizationWebhookEndpointState = 'disabled' | 'enabled';

export interface WebhookCreateParams {
  /**
   * Body param: The event types to deliver to the endpoint. Must list at least one.
   */
  enabled_events: Array<
    'user_profile.enforcement_action_opened' | 'user_profile.enforcement_action_resolved'
  >;

  /**
   * Body param: The HTTPS URL that deliveries are sent to.
   */
  url: string;

  /**
   * Body param: Notes about the endpoint.
   */
  description?: string;

  /**
   * Body param: A short label for the endpoint.
   */
  name?: string;

  /**
   * Header param: This endpoint is in beta: requests must send `webhooks-2026-10-07`
   * in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WebhookRetrieveParams {
  /**
   * This endpoint is in beta: requests must send `webhooks-2026-10-07` in this
   * header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WebhookUpdateParams {
  /**
   * Body param: Notes about the endpoint.
   */
  description?: string;

  /**
   * Body param: The event types to deliver to the endpoint. Replaces the whole set;
   * an empty list leaves it unchanged.
   */
  enabled_events?: Array<
    'user_profile.enforcement_action_opened' | 'user_profile.enforcement_action_resolved'
  >;

  /**
   * Body param: A short label for the endpoint.
   */
  name?: string;

  /**
   * Body param: `disabled` stops deliveries. `enabled` resumes them and clears
   * `disabled_reason`. Events that happen while the endpoint is disabled are never
   * delivered.
   */
  state?: 'disabled' | 'enabled';

  /**
   * Body param: The HTTPS URL that deliveries are sent to.
   */
  url?: string;

  /**
   * Header param: This endpoint is in beta: requests must send `webhooks-2026-10-07`
   * in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WebhookListParams extends PageParams {
  /**
   * Query param: Sort order by `created_at`. Defaults to `desc`, newest first.
   */
  order?: 'asc' | 'desc' | null;

  /**
   * Header param: This endpoint is in beta: requests must send `webhooks-2026-10-07`
   * in this header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WebhookDeleteParams {
  /**
   * This endpoint is in beta: requests must send `webhooks-2026-10-07` in this
   * header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export interface WebhookRegenerateSigningSecretParams {
  /**
   * This endpoint is in beta: requests must send `webhooks-2026-10-07` in this
   * header.
   */
  betas?: Array<BetaAPI.AnthropicBeta>;
}

export declare namespace Webhooks {
  export {
    type BetaDeletedOrganizationWebhookEndpoint as BetaDeletedOrganizationWebhookEndpoint,
    type BetaNewOrganizationWebhookEndpoint as BetaNewOrganizationWebhookEndpoint,
    type BetaOrganizationWebhookEndpoint as BetaOrganizationWebhookEndpoint,
    type BetaOrganizationWebhookEndpointSigningSecret as BetaOrganizationWebhookEndpointSigningSecret,
    type BetaOrganizationWebhookEndpointState as BetaOrganizationWebhookEndpointState,
    type BetaOrganizationWebhookEndpointsPage as BetaOrganizationWebhookEndpointsPage,
    type WebhookCreateParams as WebhookCreateParams,
    type WebhookRetrieveParams as WebhookRetrieveParams,
    type WebhookUpdateParams as WebhookUpdateParams,
    type WebhookListParams as WebhookListParams,
    type WebhookDeleteParams as WebhookDeleteParams,
    type WebhookRegenerateSigningSecretParams as WebhookRegenerateSigningSecretParams,
  };
}
