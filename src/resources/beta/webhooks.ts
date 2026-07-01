// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import { Webhook } from 'standardwebhooks';

export class Webhooks extends APIResource {
  unwrap(
    body: string,
    { headers, key }: { headers: Record<string, string>; key?: string },
  ): UnwrapWebhookEvent {
    if (headers !== undefined) {
      const keyStr: string | null = key === undefined ? this._client.webhookKey : key;
      if (keyStr === null) throw new Error('Webhook key must not be null in order to unwrap');
      const wh = new Webhook(keyStr);
      wh.verify(body, headers);
    }
    return JSON.parse(body) as UnwrapWebhookEvent;
  }
}

export interface BetaWebhookAgentArchivedEventData {
  /**
   * ID of the agent that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'agent.archived';

  workspace_id: string;
}

export interface BetaWebhookAgentCreatedEventData {
  /**
   * ID of the agent that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'agent.created';

  workspace_id: string;
}

export interface BetaWebhookAgentDeletedEventData {
  /**
   * ID of the agent that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'agent.deleted';

  workspace_id: string;
}

export interface BetaWebhookAgentUpdatedEventData {
  /**
   * ID of the agent that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'agent.updated';

  workspace_id: string;
}

export interface BetaWebhookDeploymentArchivedEventData {
  /**
   * ID of the deployment that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'deployment.archived';

  workspace_id: string;
}

export interface BetaWebhookDeploymentCreatedEventData {
  /**
   * ID of the deployment that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'deployment.created';

  workspace_id: string;
}

export interface BetaWebhookDeploymentDeletedEventData {
  /**
   * ID of the deployment that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'deployment.deleted';

  workspace_id: string;
}

export interface BetaWebhookDeploymentPausedEventData {
  /**
   * ID of the deployment that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'deployment.paused';

  workspace_id: string;
}

export interface BetaWebhookDeploymentRunFailedEventData {
  /**
   * ID of the deployment run that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'deployment_run.failed';

  workspace_id: string;
}

export interface BetaWebhookDeploymentRunStartedEventData {
  /**
   * ID of the deployment run that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'deployment_run.started';

  workspace_id: string;
}

export interface BetaWebhookDeploymentRunSucceededEventData {
  /**
   * ID of the deployment run that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'deployment_run.succeeded';

  workspace_id: string;
}

export interface BetaWebhookDeploymentUnpausedEventData {
  /**
   * ID of the deployment that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'deployment.unpaused';

  workspace_id: string;
}

export interface BetaWebhookDeploymentUpdatedEventData {
  /**
   * ID of the deployment that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'deployment.updated';

  workspace_id: string;
}

export interface BetaWebhookEvent {
  /**
   * Unique event identifier for idempotency.
   */
  id: string;

  /**
   * RFC 3339 timestamp when the event occurred.
   */
  created_at: string;

  data: BetaWebhookEventData;

  /**
   * Object type. Always `event` for webhook payloads.
   */
  type: 'event';
}

export type BetaWebhookEventData =
  | BetaWebhookSessionCreatedEventData
  | BetaWebhookSessionPendingEventData
  | BetaWebhookSessionRunningEventData
  | BetaWebhookSessionIdledEventData
  | BetaWebhookSessionRequiresActionEventData
  | BetaWebhookSessionArchivedEventData
  | BetaWebhookSessionDeletedEventData
  | BetaWebhookSessionStatusRescheduledEventData
  | BetaWebhookSessionStatusRunStartedEventData
  | BetaWebhookSessionStatusIdledEventData
  | BetaWebhookSessionStatusTerminatedEventData
  | BetaWebhookSessionThreadCreatedEventData
  | BetaWebhookSessionThreadIdledEventData
  | BetaWebhookSessionThreadTerminatedEventData
  | BetaWebhookSessionOutcomeEvaluationEndedEventData
  | BetaWebhookVaultCreatedEventData
  | BetaWebhookVaultArchivedEventData
  | BetaWebhookVaultDeletedEventData
  | BetaWebhookVaultCredentialCreatedEventData
  | BetaWebhookVaultCredentialArchivedEventData
  | BetaWebhookVaultCredentialDeletedEventData
  | BetaWebhookVaultCredentialRefreshFailedEventData
  | BetaWebhookSessionUpdatedEventData
  | BetaWebhookAgentCreatedEventData
  | BetaWebhookAgentArchivedEventData
  | BetaWebhookAgentDeletedEventData
  | BetaWebhookDeploymentPausedEventData
  | BetaWebhookDeploymentRunFailedEventData
  | BetaWebhookDeploymentCreatedEventData
  | BetaWebhookDeploymentUpdatedEventData
  | BetaWebhookDeploymentUnpausedEventData
  | BetaWebhookAgentUpdatedEventData
  | BetaWebhookDeploymentArchivedEventData
  | BetaWebhookDeploymentRunStartedEventData
  | BetaWebhookDeploymentDeletedEventData
  | BetaWebhookDeploymentRunSucceededEventData;

export interface BetaWebhookSessionArchivedEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.archived';

  workspace_id: string;
}

export interface BetaWebhookSessionCreatedEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.created';

  workspace_id: string;
}

export interface BetaWebhookSessionDeletedEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.deleted';

  workspace_id: string;
}

export interface BetaWebhookSessionIdledEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.idled';

  workspace_id: string;
}

export interface BetaWebhookSessionOutcomeEvaluationEndedEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.outcome_evaluation_ended';

  workspace_id: string;
}

export interface BetaWebhookSessionPendingEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.pending';

  workspace_id: string;
}

export interface BetaWebhookSessionRequiresActionEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.requires_action';

  workspace_id: string;
}

export interface BetaWebhookSessionRunningEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.running';

  workspace_id: string;
}

export interface BetaWebhookSessionStatusIdledEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.status_idled';

  workspace_id: string;
}

export interface BetaWebhookSessionStatusRescheduledEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.status_rescheduled';

  workspace_id: string;
}

export interface BetaWebhookSessionStatusRunStartedEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.status_run_started';

  workspace_id: string;
}

export interface BetaWebhookSessionStatusTerminatedEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.status_terminated';

  workspace_id: string;
}

export interface BetaWebhookSessionThreadCreatedEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  /**
   * ID of the session thread this event refers to.
   */
  session_thread_id: string;

  type: 'session.thread_created';

  workspace_id: string;
}

export interface BetaWebhookSessionThreadIdledEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  /**
   * ID of the session thread this event refers to.
   */
  session_thread_id: string;

  type: 'session.thread_idled';

  workspace_id: string;
}

export interface BetaWebhookSessionThreadTerminatedEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  /**
   * ID of the session thread this event refers to.
   */
  session_thread_id: string;

  type: 'session.thread_terminated';

  workspace_id: string;
}

export interface BetaWebhookSessionUpdatedEventData {
  /**
   * ID of the session that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'session.updated';

  workspace_id: string;
}

export interface BetaWebhookVaultArchivedEventData {
  /**
   * ID of the vault that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'vault.archived';

  workspace_id: string;
}

export interface BetaWebhookVaultCreatedEventData {
  /**
   * ID of the vault that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'vault.created';

  workspace_id: string;
}

export interface BetaWebhookVaultCredentialArchivedEventData {
  /**
   * ID of the vault credential that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'vault_credential.archived';

  /**
   * ID of the vault that owns this credential.
   */
  vault_id: string;

  workspace_id: string;
}

export interface BetaWebhookVaultCredentialCreatedEventData {
  /**
   * ID of the vault credential that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'vault_credential.created';

  /**
   * ID of the vault that owns this credential.
   */
  vault_id: string;

  workspace_id: string;
}

export interface BetaWebhookVaultCredentialDeletedEventData {
  /**
   * ID of the vault credential that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'vault_credential.deleted';

  /**
   * ID of the vault that owns this credential.
   */
  vault_id: string;

  workspace_id: string;
}

export interface BetaWebhookVaultCredentialRefreshFailedEventData {
  /**
   * ID of the vault credential that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'vault_credential.refresh_failed';

  /**
   * ID of the vault that owns this credential.
   */
  vault_id: string;

  workspace_id: string;
}

export interface BetaWebhookVaultDeletedEventData {
  /**
   * ID of the vault that triggered the event.
   */
  id: string;

  organization_id: string;

  type: 'vault.deleted';

  workspace_id: string;
}

export interface UnwrapWebhookEvent {
  /**
   * Unique event identifier for idempotency.
   */
  id: string;

  /**
   * RFC 3339 timestamp when the event occurred.
   */
  created_at: string;

  data: BetaWebhookEventData;

  /**
   * Object type. Always `event` for webhook payloads.
   */
  type: 'event';
}

export declare namespace Webhooks {
  export {
    type BetaWebhookAgentArchivedEventData as BetaWebhookAgentArchivedEventData,
    type BetaWebhookAgentCreatedEventData as BetaWebhookAgentCreatedEventData,
    type BetaWebhookAgentDeletedEventData as BetaWebhookAgentDeletedEventData,
    type BetaWebhookAgentUpdatedEventData as BetaWebhookAgentUpdatedEventData,
    type BetaWebhookDeploymentArchivedEventData as BetaWebhookDeploymentArchivedEventData,
    type BetaWebhookDeploymentCreatedEventData as BetaWebhookDeploymentCreatedEventData,
    type BetaWebhookDeploymentDeletedEventData as BetaWebhookDeploymentDeletedEventData,
    type BetaWebhookDeploymentPausedEventData as BetaWebhookDeploymentPausedEventData,
    type BetaWebhookDeploymentRunFailedEventData as BetaWebhookDeploymentRunFailedEventData,
    type BetaWebhookDeploymentRunStartedEventData as BetaWebhookDeploymentRunStartedEventData,
    type BetaWebhookDeploymentRunSucceededEventData as BetaWebhookDeploymentRunSucceededEventData,
    type BetaWebhookDeploymentUnpausedEventData as BetaWebhookDeploymentUnpausedEventData,
    type BetaWebhookDeploymentUpdatedEventData as BetaWebhookDeploymentUpdatedEventData,
    type BetaWebhookEvent as BetaWebhookEvent,
    type BetaWebhookEventData as BetaWebhookEventData,
    type BetaWebhookSessionArchivedEventData as BetaWebhookSessionArchivedEventData,
    type BetaWebhookSessionCreatedEventData as BetaWebhookSessionCreatedEventData,
    type BetaWebhookSessionDeletedEventData as BetaWebhookSessionDeletedEventData,
    type BetaWebhookSessionIdledEventData as BetaWebhookSessionIdledEventData,
    type BetaWebhookSessionOutcomeEvaluationEndedEventData as BetaWebhookSessionOutcomeEvaluationEndedEventData,
    type BetaWebhookSessionPendingEventData as BetaWebhookSessionPendingEventData,
    type BetaWebhookSessionRequiresActionEventData as BetaWebhookSessionRequiresActionEventData,
    type BetaWebhookSessionRunningEventData as BetaWebhookSessionRunningEventData,
    type BetaWebhookSessionStatusIdledEventData as BetaWebhookSessionStatusIdledEventData,
    type BetaWebhookSessionStatusRescheduledEventData as BetaWebhookSessionStatusRescheduledEventData,
    type BetaWebhookSessionStatusRunStartedEventData as BetaWebhookSessionStatusRunStartedEventData,
    type BetaWebhookSessionStatusTerminatedEventData as BetaWebhookSessionStatusTerminatedEventData,
    type BetaWebhookSessionThreadCreatedEventData as BetaWebhookSessionThreadCreatedEventData,
    type BetaWebhookSessionThreadIdledEventData as BetaWebhookSessionThreadIdledEventData,
    type BetaWebhookSessionThreadTerminatedEventData as BetaWebhookSessionThreadTerminatedEventData,
    type BetaWebhookSessionUpdatedEventData as BetaWebhookSessionUpdatedEventData,
    type BetaWebhookVaultArchivedEventData as BetaWebhookVaultArchivedEventData,
    type BetaWebhookVaultCreatedEventData as BetaWebhookVaultCreatedEventData,
    type BetaWebhookVaultCredentialArchivedEventData as BetaWebhookVaultCredentialArchivedEventData,
    type BetaWebhookVaultCredentialCreatedEventData as BetaWebhookVaultCredentialCreatedEventData,
    type BetaWebhookVaultCredentialDeletedEventData as BetaWebhookVaultCredentialDeletedEventData,
    type BetaWebhookVaultCredentialRefreshFailedEventData as BetaWebhookVaultCredentialRefreshFailedEventData,
    type BetaWebhookVaultDeletedEventData as BetaWebhookVaultDeletedEventData,
    type UnwrapWebhookEvent as UnwrapWebhookEvent,
  };
}
