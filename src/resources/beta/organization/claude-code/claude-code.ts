import { APIResource } from '../../../../core/resource';
import * as ManagedSettingsAPI from './managed-settings/managed-settings';
import {
  BetaCMEKFeatureUnsupportedError,
  BetaCMEKFeatureUnsupportedErrorDetails,
  BetaRBACGroupManagedSettingsNotFoundError,
  BetaRBACGroupManagedSettingsNotFoundErrorDetails,
  BetaRBACGroupOrderLimitExceededError,
  BetaRBACGroupOrderLimitExceededErrorDetails,
  BetaSettingsDocumentLimitExceededError,
  BetaSettingsDocumentLimitExceededErrorDetails,
  BetaSettingsHistoryLimitExceededError,
  BetaSettingsHistoryLimitExceededErrorDetails,
  ManagedSettings,
} from './managed-settings/managed-settings';

export class ClaudeCode extends APIResource {
  managedSettings: ManagedSettingsAPI.ManagedSettings = new ManagedSettingsAPI.ManagedSettings(this._client);
}

ClaudeCode.ManagedSettings = ManagedSettings;
ClaudeCode.BetaCMEKFeatureUnsupportedError = BetaCMEKFeatureUnsupportedError;
ClaudeCode.BetaRBACGroupOrderLimitExceededError = BetaRBACGroupOrderLimitExceededError;
ClaudeCode.BetaSettingsDocumentLimitExceededError = BetaSettingsDocumentLimitExceededError;
ClaudeCode.BetaSettingsHistoryLimitExceededError = BetaSettingsHistoryLimitExceededError;
ClaudeCode.BetaRBACGroupManagedSettingsNotFoundError = BetaRBACGroupManagedSettingsNotFoundError;

export declare namespace ClaudeCode {
  export {
    ManagedSettings as ManagedSettings,
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
}
