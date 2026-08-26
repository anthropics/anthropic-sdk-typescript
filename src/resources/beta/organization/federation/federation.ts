// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../core/resource';
import * as IssuersAPI from './issuers';
import {
  BetaFederationIssuer,
  BetaFederationIssuerPollStatus,
  BetaFederationIssuersPageCursor,
  BetaJWKSDiscovery,
  BetaJWKSExplicitURL,
  BetaJWKSInline,
  IssuerArchiveParams,
  IssuerCreateParams,
  IssuerListParams,
  IssuerRetrieveParams,
  IssuerUpdateParams,
  Issuers,
} from './issuers';
import * as RulesAPI from './rules/rules';
import {
  BetaFederationRule,
  BetaFederationRuleMatch,
  BetaFederationRuleWorkspace,
  BetaFederationRulesPageCursor,
  BetaServiceAccountTarget,
  RuleArchiveParams,
  RuleCreateParams,
  RuleListParams,
  RuleRetrieveParams,
  RuleUpdateParams,
  Rules,
} from './rules/rules';

export class Federation extends APIResource {
  issuers: IssuersAPI.Issuers = new IssuersAPI.Issuers(this._client);
  rules: RulesAPI.Rules = new RulesAPI.Rules(this._client);
}

Federation.Issuers = Issuers;
Federation.Rules = Rules;

export declare namespace Federation {
  export {
    Issuers as Issuers,
    type BetaFederationIssuer as BetaFederationIssuer,
    type BetaFederationIssuerPollStatus as BetaFederationIssuerPollStatus,
    type BetaJWKSDiscovery as BetaJWKSDiscovery,
    type BetaJWKSExplicitURL as BetaJWKSExplicitURL,
    type BetaJWKSInline as BetaJWKSInline,
    type BetaFederationIssuersPageCursor as BetaFederationIssuersPageCursor,
    type IssuerCreateParams as IssuerCreateParams,
    type IssuerRetrieveParams as IssuerRetrieveParams,
    type IssuerUpdateParams as IssuerUpdateParams,
    type IssuerListParams as IssuerListParams,
    type IssuerArchiveParams as IssuerArchiveParams,
  };

  export {
    Rules as Rules,
    type BetaFederationRule as BetaFederationRule,
    type BetaFederationRuleMatch as BetaFederationRuleMatch,
    type BetaFederationRuleWorkspace as BetaFederationRuleWorkspace,
    type BetaServiceAccountTarget as BetaServiceAccountTarget,
    type BetaFederationRulesPageCursor as BetaFederationRulesPageCursor,
    type RuleCreateParams as RuleCreateParams,
    type RuleRetrieveParams as RuleRetrieveParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
    type RuleArchiveParams as RuleArchiveParams,
  };
}
