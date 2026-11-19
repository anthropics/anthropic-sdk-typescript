import { APIResource } from '../../../../../core/resource';
import * as ConfigurationAPI from './configuration';
import {
  BetaClaudeCodeManagedSettingsConfiguration,
  BetaClaudeCodeManagedSettingsMode,
  BetaClaudeCodeManagedSettingsModeParam,
  BetaClaudeCodeManagedSettingsOrganizationMode,
  BetaClaudeCodeManagedSettingsOrganizationModeParam,
  BetaClaudeCodeManagedSettingsRBACGroupsMode,
  BetaClaudeCodeManagedSettingsRBACGroupsModeParam,
  Configuration,
  ConfigurationRetrieveParams,
  ConfigurationUpdateParams,
} from './configuration';
import * as RBACGroupDefaultAPI from './rbac-group-default';
import {
  BetaClaudeCodeRBACGroupDefaultManagedSettings,
  RBACGroupDefault,
  RBACGroupDefaultRetrieveParams,
  RBACGroupDefaultUpdateParams,
} from './rbac-group-default';
import * as RBACGroupsAPI from './rbac-groups';
import {
  BetaClaudeCodeRBACGroupManagedSettings,
  BetaClaudeCodeRBACGroupManagedSettingsSummariesPageCursor,
  BetaClaudeCodeRBACGroupManagedSettingsSummary,
  BetaClaudeCodeRBACGroupStatus,
  BetaClaudeCodeRBACGroupStatusActive,
  BetaClaudeCodeRBACGroupStatusDeleted,
  BetaClaudeCodeRBACGroupStatusUnknown,
  BetaDeletedClaudeCodeRBACGroupManagedSettings,
  RBACGroupDeleteParams,
  RBACGroupListParams,
  RBACGroupRetrieveParams,
  RBACGroupSetParams,
  RBACGroups,
} from './rbac-groups';
import { BadRequestError, NotFoundError } from '../../../../../core/error';

/**
 * This stored settings document currently cannot be read or replaced. Contact
 * support, or, if you no longer need these settings, delete the group's settings
 * or clear the default.
 */
export class BetaCMEKFeatureUnsupportedError extends BadRequestError {
  declare readonly errorCode: 'cmek_feature_unsupported';
  declare readonly details: BetaCMEKFeatureUnsupportedErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaCMEKFeatureUnsupportedError';
}

/**
 * The RBAC Group order already has the most groups allowed. Delete another group's
 * settings first.
 */
export class BetaRBACGroupOrderLimitExceededError extends BadRequestError {
  declare readonly errorCode: 'rbac_group_order_limit_exceeded';
  declare readonly details: BetaRBACGroupOrderLimitExceededErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaRBACGroupOrderLimitExceededError';
}

/**
 * The organization has reached its limit of settings documents, counting unused
 * ones. An owner can remove unused documents in claude.ai. Deleting a group's
 * settings or clearing the default settings also frees a document, if nothing else
 * uses it. None of these works once the organization has also reached its settings
 * history limit.
 */
export class BetaSettingsDocumentLimitExceededError extends BadRequestError {
  declare readonly errorCode: 'settings_document_limit_exceeded';
  declare readonly details: BetaSettingsDocumentLimitExceededErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaSettingsDocumentLimitExceededError';
}

/**
 * The organization has reached its settings history limit, a cap on stored
 * versions of its settings documents. Nothing in the API or claude.ai lowers the
 * count, so contact support. Creating or deleting group settings, creating or
 * clearing the default settings, and reordering are refused. Changing the mode
 * still works, unless it would copy the organization settings into a new default.
 */
export class BetaSettingsHistoryLimitExceededError extends BadRequestError {
  declare readonly errorCode: 'settings_history_limit_exceeded';
  declare readonly details: BetaSettingsHistoryLimitExceededErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaSettingsHistoryLimitExceededError';
}

/**
 * This RBAC Group has no Claude Code managed settings.
 */
export class BetaRBACGroupManagedSettingsNotFoundError extends NotFoundError {
  declare readonly errorCode: 'rbac_group_managed_settings_not_found';
  declare readonly details: BetaRBACGroupManagedSettingsNotFoundErrorDetails;

  /** @internal */
  static override readonly _errorName: string = 'BetaRBACGroupManagedSettingsNotFoundError';
}

export class ManagedSettings extends APIResource {
  configuration: ConfigurationAPI.Configuration = new ConfigurationAPI.Configuration(this._client);
  rbacGroups: RBACGroupsAPI.RBACGroups = new RBACGroupsAPI.RBACGroups(this._client);
  rbacGroupDefault: RBACGroupDefaultAPI.RBACGroupDefault = new RBACGroupDefaultAPI.RBACGroupDefault(
    this._client,
  );
}

/**
 * This stored settings document currently cannot be read or replaced. Contact
 * support, or, if you no longer need these settings, delete the group's settings
 * or clear the default.
 */
export interface BetaCMEKFeatureUnsupportedErrorDetails {
  error_code: 'cmek_feature_unsupported';
}

/**
 * This RBAC Group has no Claude Code managed settings.
 */
export interface BetaRBACGroupManagedSettingsNotFoundErrorDetails {
  error_code: 'rbac_group_managed_settings_not_found';
}

/**
 * The RBAC Group order already has the most groups allowed. Delete another group's
 * settings first.
 */
export interface BetaRBACGroupOrderLimitExceededErrorDetails {
  error_code: 'rbac_group_order_limit_exceeded';
}

/**
 * The organization has reached its limit of settings documents, counting unused
 * ones. An owner can remove unused documents in claude.ai. Deleting a group's
 * settings or clearing the default settings also frees a document, if nothing else
 * uses it. None of these works once the organization has also reached its settings
 * history limit.
 */
export interface BetaSettingsDocumentLimitExceededErrorDetails {
  error_code: 'settings_document_limit_exceeded';
}

/**
 * The organization has reached its settings history limit, a cap on stored
 * versions of its settings documents. Nothing in the API or claude.ai lowers the
 * count, so contact support. Creating or deleting group settings, creating or
 * clearing the default settings, and reordering are refused. Changing the mode
 * still works, unless it would copy the organization settings into a new default.
 */
export interface BetaSettingsHistoryLimitExceededErrorDetails {
  error_code: 'settings_history_limit_exceeded';
}

ManagedSettings.BetaCMEKFeatureUnsupportedError = BetaCMEKFeatureUnsupportedError;
ManagedSettings.BetaRBACGroupOrderLimitExceededError = BetaRBACGroupOrderLimitExceededError;
ManagedSettings.BetaSettingsDocumentLimitExceededError = BetaSettingsDocumentLimitExceededError;
ManagedSettings.BetaSettingsHistoryLimitExceededError = BetaSettingsHistoryLimitExceededError;
ManagedSettings.BetaRBACGroupManagedSettingsNotFoundError = BetaRBACGroupManagedSettingsNotFoundError;
ManagedSettings.Configuration = Configuration;
ManagedSettings.RBACGroups = RBACGroups;
ManagedSettings.RBACGroupDefault = RBACGroupDefault;

export declare namespace ManagedSettings {
  export {
    BetaCMEKFeatureUnsupportedError as BetaCMEKFeatureUnsupportedError,
    BetaRBACGroupOrderLimitExceededError as BetaRBACGroupOrderLimitExceededError,
    BetaSettingsDocumentLimitExceededError as BetaSettingsDocumentLimitExceededError,
    BetaSettingsHistoryLimitExceededError as BetaSettingsHistoryLimitExceededError,
    BetaRBACGroupManagedSettingsNotFoundError as BetaRBACGroupManagedSettingsNotFoundError,
    type BetaCMEKFeatureUnsupportedErrorDetails as BetaCMEKFeatureUnsupportedErrorDetails,
    type BetaRBACGroupManagedSettingsNotFoundErrorDetails as BetaRBACGroupManagedSettingsNotFoundErrorDetails,
    type BetaRBACGroupOrderLimitExceededErrorDetails as BetaRBACGroupOrderLimitExceededErrorDetails,
    type BetaSettingsDocumentLimitExceededErrorDetails as BetaSettingsDocumentLimitExceededErrorDetails,
    type BetaSettingsHistoryLimitExceededErrorDetails as BetaSettingsHistoryLimitExceededErrorDetails,
  };

  export {
    Configuration as Configuration,
    type BetaClaudeCodeManagedSettingsConfiguration as BetaClaudeCodeManagedSettingsConfiguration,
    type BetaClaudeCodeManagedSettingsMode as BetaClaudeCodeManagedSettingsMode,
    type BetaClaudeCodeManagedSettingsModeParam as BetaClaudeCodeManagedSettingsModeParam,
    type BetaClaudeCodeManagedSettingsOrganizationMode as BetaClaudeCodeManagedSettingsOrganizationMode,
    type BetaClaudeCodeManagedSettingsOrganizationModeParam as BetaClaudeCodeManagedSettingsOrganizationModeParam,
    type BetaClaudeCodeManagedSettingsRBACGroupsMode as BetaClaudeCodeManagedSettingsRBACGroupsMode,
    type BetaClaudeCodeManagedSettingsRBACGroupsModeParam as BetaClaudeCodeManagedSettingsRBACGroupsModeParam,
    type ConfigurationRetrieveParams as ConfigurationRetrieveParams,
    type ConfigurationUpdateParams as ConfigurationUpdateParams,
  };

  export {
    RBACGroups as RBACGroups,
    type BetaClaudeCodeRBACGroupManagedSettings as BetaClaudeCodeRBACGroupManagedSettings,
    type BetaClaudeCodeRBACGroupManagedSettingsSummary as BetaClaudeCodeRBACGroupManagedSettingsSummary,
    type BetaClaudeCodeRBACGroupStatus as BetaClaudeCodeRBACGroupStatus,
    type BetaClaudeCodeRBACGroupStatusActive as BetaClaudeCodeRBACGroupStatusActive,
    type BetaClaudeCodeRBACGroupStatusDeleted as BetaClaudeCodeRBACGroupStatusDeleted,
    type BetaClaudeCodeRBACGroupStatusUnknown as BetaClaudeCodeRBACGroupStatusUnknown,
    type BetaDeletedClaudeCodeRBACGroupManagedSettings as BetaDeletedClaudeCodeRBACGroupManagedSettings,
    type BetaClaudeCodeRBACGroupManagedSettingsSummariesPageCursor as BetaClaudeCodeRBACGroupManagedSettingsSummariesPageCursor,
    type RBACGroupRetrieveParams as RBACGroupRetrieveParams,
    type RBACGroupListParams as RBACGroupListParams,
    type RBACGroupDeleteParams as RBACGroupDeleteParams,
    type RBACGroupSetParams as RBACGroupSetParams,
  };

  export {
    RBACGroupDefault as RBACGroupDefault,
    type BetaClaudeCodeRBACGroupDefaultManagedSettings as BetaClaudeCodeRBACGroupDefaultManagedSettings,
    type RBACGroupDefaultRetrieveParams as RBACGroupDefaultRetrieveParams,
    type RBACGroupDefaultUpdateParams as RBACGroupDefaultUpdateParams,
  };
}
