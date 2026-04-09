// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as EnvironmentsAPI from './environments';
import {
  BetaCloudConfig,
  BetaCloudConfigParams,
  BetaEnvironment,
  BetaEnvironmentDeleteResponse,
  BetaEnvironmentsPageCursor,
  BetaLimitedNetwork,
  BetaLimitedNetworkParams,
  BetaPackages,
  BetaPackagesParams,
  BetaUnrestrictedNetwork,
  EnvironmentArchiveParams,
  EnvironmentCreateParams,
  EnvironmentDeleteParams,
  EnvironmentListParams,
  EnvironmentRetrieveParams,
  EnvironmentUpdateParams,
  Environments,
} from './environments';
import * as FilesAPI from './files';
import {
  BetaFileScope,
  DeletedFile,
  FileDeleteParams,
  FileDownloadParams,
  FileListParams,
  FileMetadata,
  FileMetadataPage,
  FileRetrieveMetadataParams,
  FileUploadParams,
  Files,
} from './files';
import * as ModelsAPI from './models';
import {
  BetaCapabilitySupport,
  BetaContextManagementCapability,
  BetaEffortCapability,
  BetaModelCapabilities,
  BetaModelInfo,
  BetaModelInfosPage,
  BetaThinkingCapability,
  BetaThinkingTypes,
  ModelListParams,
  ModelRetrieveParams,
  Models,
} from './models';
import * as AgentsAPI from './agents/agents';
import {
  AgentArchiveParams,
  AgentCreateParams,
  AgentListParams,
  AgentRetrieveParams,
  AgentUpdateParams,
  Agents,
  BetaManagedAgentsAgent,
  BetaManagedAgentsAgentToolConfig,
  BetaManagedAgentsAgentToolConfigParams,
  BetaManagedAgentsAgentToolset20260401,
  BetaManagedAgentsAgentToolset20260401Params,
  BetaManagedAgentsAgentToolsetDefaultConfig,
  BetaManagedAgentsAgentToolsetDefaultConfigParams,
  BetaManagedAgentsAgentsPageCursor,
  BetaManagedAgentsAlwaysAllowPolicy,
  BetaManagedAgentsAlwaysAskPolicy,
  BetaManagedAgentsAnthropicSkill,
  BetaManagedAgentsAnthropicSkillParams,
  BetaManagedAgentsCustomSkill,
  BetaManagedAgentsCustomSkillParams,
  BetaManagedAgentsCustomTool,
  BetaManagedAgentsCustomToolInputSchema,
  BetaManagedAgentsCustomToolParams,
  BetaManagedAgentsMCPServerURLDefinition,
  BetaManagedAgentsMCPToolConfig,
  BetaManagedAgentsMCPToolConfigParams,
  BetaManagedAgentsMCPToolset,
  BetaManagedAgentsMCPToolsetDefaultConfig,
  BetaManagedAgentsMCPToolsetDefaultConfigParams,
  BetaManagedAgentsMCPToolsetParams,
  BetaManagedAgentsModel,
  BetaManagedAgentsModelConfig,
  BetaManagedAgentsModelConfigParams,
  BetaManagedAgentsSkillParams,
  BetaManagedAgentsURLMCPServerParams,
} from './agents/agents';
import * as MessagesAPI from './messages/messages';
import {
  BetaAdvisorMessageIterationUsage,
  BetaAdvisorRedactedResultBlock,
  BetaAdvisorRedactedResultBlockParam,
  BetaAdvisorResultBlock,
  BetaAdvisorResultBlockParam,
  BetaAdvisorTool20260301,
  BetaAdvisorToolResultBlock,
  BetaAdvisorToolResultBlockParam,
  BetaAdvisorToolResultError,
  BetaAdvisorToolResultErrorParam,
  BetaAllThinkingTurns,
  BetaBase64ImageSource,
  BetaBase64PDFBlock,
  BetaBase64PDFSource,
  BetaBashCodeExecutionOutputBlock,
  BetaBashCodeExecutionOutputBlockParam,
  BetaBashCodeExecutionResultBlock,
  BetaBashCodeExecutionResultBlockParam,
  BetaBashCodeExecutionToolResultBlock,
  BetaBashCodeExecutionToolResultBlockParam,
  BetaBashCodeExecutionToolResultError,
  BetaBashCodeExecutionToolResultErrorParam,
  BetaCacheControlEphemeral,
  BetaCacheCreation,
  BetaCitationCharLocation,
  BetaCitationCharLocationParam,
  BetaCitationConfig,
  BetaCitationContentBlockLocation,
  BetaCitationContentBlockLocationParam,
  BetaCitationPageLocation,
  BetaCitationPageLocationParam,
  BetaCitationSearchResultLocation,
  BetaCitationSearchResultLocationParam,
  BetaCitationWebSearchResultLocationParam,
  BetaCitationsConfigParam,
  BetaCitationsDelta,
  BetaCitationsWebSearchResultLocation,
  BetaClearThinking20251015Edit,
  BetaClearThinking20251015EditResponse,
  BetaClearToolUses20250919Edit,
  BetaClearToolUses20250919EditResponse,
  BetaCodeExecutionOutputBlock,
  BetaCodeExecutionOutputBlockParam,
  BetaCodeExecutionResultBlock,
  BetaCodeExecutionResultBlockParam,
  BetaCodeExecutionTool20250522,
  BetaCodeExecutionTool20250825,
  BetaCodeExecutionTool20260120,
  BetaCodeExecutionToolResultBlock,
  BetaCodeExecutionToolResultBlockContent,
  BetaCodeExecutionToolResultBlockParam,
  BetaCodeExecutionToolResultBlockParamContent,
  BetaCodeExecutionToolResultError,
  BetaCodeExecutionToolResultErrorCode,
  BetaCodeExecutionToolResultErrorParam,
  BetaCompact20260112Edit,
  BetaCompactionBlock,
  BetaCompactionBlockParam,
  BetaCompactionContentBlockDelta,
  BetaCompactionIterationUsage,
  BetaContainer,
  BetaContainerParams,
  BetaContainerUploadBlock,
  BetaContainerUploadBlockParam,
  BetaContentBlock,
  BetaContentBlockParam,
  BetaContentBlockSource,
  BetaContentBlockSourceContent,
  BetaContextManagementConfig,
  BetaContextManagementResponse,
  BetaCountTokensContextManagementResponse,
  BetaDirectCaller,
  BetaDocumentBlock,
  BetaEncryptedCodeExecutionResultBlock,
  BetaEncryptedCodeExecutionResultBlockParam,
  BetaFileDocumentSource,
  BetaFileImageSource,
  BetaImageBlockParam,
  BetaInputJSONDelta,
  BetaJSONOutputFormat,
  BetaInputTokensClearAtLeast,
  BetaInputTokensTrigger,
  BetaMCPToolResultBlock,
  BetaMCPToolUseBlock,
  BetaMCPToolUseBlockParam,
  BetaMCPToolset,
  BetaMemoryTool20250818,
  BetaMemoryTool20250818Command,
  BetaMemoryTool20250818CreateCommand,
  BetaMemoryTool20250818DeleteCommand,
  BetaMemoryTool20250818InsertCommand,
  BetaMemoryTool20250818RenameCommand,
  BetaMemoryTool20250818StrReplaceCommand,
  BetaMemoryTool20250818ViewCommand,
  BetaMessage,
  BetaMessageDeltaUsage,
  BetaMessageIterationUsage,
  BetaMessageParam,
  BetaMessageTokensCount,
  BetaMetadata,
  BetaOutputConfig,
  BetaPlainTextSource,
  BetaRawContentBlockDelta,
  BetaRawContentBlockDeltaEvent,
  BetaRawContentBlockStartEvent,
  BetaRawContentBlockStopEvent,
  BetaRawMessageDeltaEvent,
  BetaRawMessageStartEvent,
  BetaRawMessageStopEvent,
  BetaRawMessageStreamEvent,
  BetaRedactedThinkingBlock,
  BetaRedactedThinkingBlockParam,
  BetaRefusalStopDetails,
  BetaRequestDocumentBlock,
  BetaRequestMCPServerToolConfiguration,
  BetaRequestMCPServerURLDefinition,
  BetaRequestMCPToolResultBlockParam,
  BetaSearchResultBlockParam,
  BetaServerToolCaller,
  BetaServerToolCaller20260120,
  BetaServerToolUsage,
  BetaServerToolUseBlock,
  BetaServerToolUseBlockParam,
  BetaSignatureDelta,
  BetaSkill,
  BetaSkillParams,
  BetaStopReason,
  BetaTextBlock,
  BetaTextBlockParam,
  BetaTextCitation,
  BetaTextCitationParam,
  BetaTextDelta,
  BetaTextEditorCodeExecutionCreateResultBlock,
  BetaTextEditorCodeExecutionCreateResultBlockParam,
  BetaTextEditorCodeExecutionStrReplaceResultBlock,
  BetaTextEditorCodeExecutionStrReplaceResultBlockParam,
  BetaTextEditorCodeExecutionToolResultBlock,
  BetaTextEditorCodeExecutionToolResultBlockParam,
  BetaTextEditorCodeExecutionToolResultError,
  BetaTextEditorCodeExecutionToolResultErrorParam,
  BetaTextEditorCodeExecutionViewResultBlock,
  BetaTextEditorCodeExecutionViewResultBlockParam,
  BetaThinkingBlock,
  BetaThinkingBlockParam,
  BetaThinkingConfigAdaptive,
  BetaThinkingConfigDisabled,
  BetaThinkingConfigEnabled,
  BetaThinkingConfigParam,
  BetaThinkingDelta,
  BetaThinkingTurns,
  BetaTool,
  BetaToolBash20241022,
  BetaToolBash20250124,
  BetaToolChoice,
  BetaToolChoiceAny,
  BetaToolChoiceAuto,
  BetaToolChoiceNone,
  BetaToolChoiceTool,
  BetaToolComputerUse20241022,
  BetaToolComputerUse20250124,
  BetaToolComputerUse20251124,
  BetaToolReferenceBlock,
  BetaToolReferenceBlockParam,
  BetaToolResultBlockParam,
  BetaToolTextEditor20241022,
  BetaToolTextEditor20250124,
  BetaToolTextEditor20250429,
  BetaToolTextEditor20250728,
  BetaToolUnion,
  BetaToolUseBlock,
  BetaToolUseBlockParam,
  BetaToolUsesKeep,
  BetaToolUsesTrigger,
  BetaURLImageSource,
  BetaURLPDFSource,
  BetaUsage,
  BetaUserLocation,
  BetaWebFetchBlock,
  BetaWebFetchBlockParam,
  BetaWebFetchTool20250910,
  BetaWebFetchTool20260209,
  BetaWebFetchTool20260309,
  BetaWebFetchToolResultBlock,
  BetaWebFetchToolResultBlockParam,
  BetaWebFetchToolResultErrorBlock,
  BetaWebFetchToolResultErrorBlockParam,
  BetaWebFetchToolResultErrorCode,
  BetaWebSearchResultBlock,
  BetaWebSearchResultBlockParam,
  BetaWebSearchTool20250305,
  BetaWebSearchTool20260209,
  BetaWebSearchToolRequestError,
  BetaWebSearchToolResultBlock,
  BetaWebSearchToolResultBlockContent,
  BetaWebSearchToolResultBlockParam,
  BetaWebSearchToolResultBlockParamContent,
  BetaWebSearchToolResultError,
  BetaWebSearchToolResultErrorCode,
  MessageCountTokensParams,
  MessageCreateParams,
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
  Messages,
  BetaMCPToolConfig,
  BetaMCPToolDefaultConfig,
} from './messages/messages';
import * as SessionsAPI from './sessions/sessions';
import {
  BetaManagedAgentsAgentParams,
  BetaManagedAgentsBranchCheckout,
  BetaManagedAgentsCacheCreationUsage,
  BetaManagedAgentsCommitCheckout,
  BetaManagedAgentsDeletedSession,
  BetaManagedAgentsFileResourceParams,
  BetaManagedAgentsGitHubRepositoryResourceParams,
  BetaManagedAgentsSession,
  BetaManagedAgentsSessionAgent,
  BetaManagedAgentsSessionStats,
  BetaManagedAgentsSessionUsage,
  BetaManagedAgentsSessionsPageCursor,
  SessionArchiveParams,
  SessionCreateParams,
  SessionDeleteParams,
  SessionListParams,
  SessionRetrieveParams,
  SessionUpdateParams,
  Sessions,
} from './sessions/sessions';
import * as SkillsAPI from './skills/skills';
import {
  SkillCreateParams,
  SkillCreateResponse,
  SkillDeleteParams,
  SkillDeleteResponse,
  SkillListParams,
  SkillListResponse,
  SkillListResponsesPageCursor,
  SkillRetrieveParams,
  SkillRetrieveResponse,
  Skills,
} from './skills/skills';
import * as VaultsAPI from './vaults/vaults';
import {
  BetaManagedAgentsDeletedVault,
  BetaManagedAgentsVault,
  BetaManagedAgentsVaultsPageCursor,
  VaultArchiveParams,
  VaultCreateParams,
  VaultDeleteParams,
  VaultListParams,
  VaultRetrieveParams,
  VaultUpdateParams,
  Vaults,
} from './vaults/vaults';

export class Beta extends APIResource {
  models: ModelsAPI.Models = new ModelsAPI.Models(this._client);
  messages: MessagesAPI.Messages = new MessagesAPI.Messages(this._client);
  agents: AgentsAPI.Agents = new AgentsAPI.Agents(this._client);
  environments: EnvironmentsAPI.Environments = new EnvironmentsAPI.Environments(this._client);
  sessions: SessionsAPI.Sessions = new SessionsAPI.Sessions(this._client);
  vaults: VaultsAPI.Vaults = new VaultsAPI.Vaults(this._client);
  files: FilesAPI.Files = new FilesAPI.Files(this._client);
  skills: SkillsAPI.Skills = new SkillsAPI.Skills(this._client);
}

export type AnthropicBeta =
  | (string & {})
  | 'message-batches-2024-09-24'
  | 'prompt-caching-2024-07-31'
  | 'computer-use-2024-10-22'
  | 'computer-use-2025-01-24'
  | 'pdfs-2024-09-25'
  | 'token-counting-2024-11-01'
  | 'token-efficient-tools-2025-02-19'
  | 'output-128k-2025-02-19'
  | 'files-api-2025-04-14'
  | 'mcp-client-2025-04-04'
  | 'mcp-client-2025-11-20'
  | 'dev-full-thinking-2025-05-14'
  | 'interleaved-thinking-2025-05-14'
  | 'code-execution-2025-05-22'
  | 'extended-cache-ttl-2025-04-11'
  | 'context-1m-2025-08-07'
  | 'context-management-2025-06-27'
  | 'model-context-window-exceeded-2025-08-26'
  | 'skills-2025-10-02'
  | 'fast-mode-2026-02-01'
  | 'output-300k-2026-03-24'
  | 'advisor-tool-2026-03-01';

export interface BetaAPIError {
  message: string;

  type: 'api_error';
}

export interface BetaAuthenticationError {
  message: string;

  type: 'authentication_error';
}

export interface BetaBillingError {
  message: string;

  type: 'billing_error';
}

export type BetaError =
  | BetaInvalidRequestError
  | BetaAuthenticationError
  | BetaBillingError
  | BetaPermissionError
  | BetaNotFoundError
  | BetaRateLimitError
  | BetaGatewayTimeoutError
  | BetaAPIError
  | BetaOverloadedError;

export interface BetaErrorResponse {
  error: BetaError;

  request_id: string | null;

  type: 'error';
}

export interface BetaGatewayTimeoutError {
  message: string;

  type: 'timeout_error';
}

export interface BetaInvalidRequestError {
  message: string;

  type: 'invalid_request_error';
}

export interface BetaNotFoundError {
  message: string;

  type: 'not_found_error';
}

export interface BetaOverloadedError {
  message: string;

  type: 'overloaded_error';
}

export interface BetaPermissionError {
  message: string;

  type: 'permission_error';
}

export interface BetaRateLimitError {
  message: string;

  type: 'rate_limit_error';
}

Beta.Models = Models;
Beta.Messages = Messages;
Beta.Agents = Agents;
Beta.Environments = Environments;
Beta.Sessions = Sessions;
Beta.Vaults = Vaults;
Beta.Files = Files;
Beta.Skills = Skills;

export declare namespace Beta {
  export {
    type AnthropicBeta as AnthropicBeta,
    type BetaAPIError as BetaAPIError,
    type BetaAuthenticationError as BetaAuthenticationError,
    type BetaBillingError as BetaBillingError,
    type BetaError as BetaError,
    type BetaErrorResponse as BetaErrorResponse,
    type BetaGatewayTimeoutError as BetaGatewayTimeoutError,
    type BetaInvalidRequestError as BetaInvalidRequestError,
    type BetaNotFoundError as BetaNotFoundError,
    type BetaOverloadedError as BetaOverloadedError,
    type BetaPermissionError as BetaPermissionError,
    type BetaRateLimitError as BetaRateLimitError,
  };

  export {
    Models as Models,
    type BetaCapabilitySupport as BetaCapabilitySupport,
    type BetaContextManagementCapability as BetaContextManagementCapability,
    type BetaEffortCapability as BetaEffortCapability,
    type BetaModelCapabilities as BetaModelCapabilities,
    type BetaModelInfo as BetaModelInfo,
    type BetaThinkingCapability as BetaThinkingCapability,
    type BetaThinkingTypes as BetaThinkingTypes,
    type BetaModelInfosPage as BetaModelInfosPage,
    type ModelRetrieveParams as ModelRetrieveParams,
    type ModelListParams as ModelListParams,
  };

  export {
    Messages as Messages,
    type BetaAdvisorMessageIterationUsage as BetaAdvisorMessageIterationUsage,
    type BetaAdvisorRedactedResultBlock as BetaAdvisorRedactedResultBlock,
    type BetaAdvisorRedactedResultBlockParam as BetaAdvisorRedactedResultBlockParam,
    type BetaAdvisorResultBlock as BetaAdvisorResultBlock,
    type BetaAdvisorResultBlockParam as BetaAdvisorResultBlockParam,
    type BetaAdvisorTool20260301 as BetaAdvisorTool20260301,
    type BetaAdvisorToolResultBlock as BetaAdvisorToolResultBlock,
    type BetaAdvisorToolResultBlockParam as BetaAdvisorToolResultBlockParam,
    type BetaAdvisorToolResultError as BetaAdvisorToolResultError,
    type BetaAdvisorToolResultErrorParam as BetaAdvisorToolResultErrorParam,
    type BetaAllThinkingTurns as BetaAllThinkingTurns,
    type BetaBase64ImageSource as BetaBase64ImageSource,
    type BetaBase64PDFSource as BetaBase64PDFSource,
    type BetaBashCodeExecutionOutputBlock as BetaBashCodeExecutionOutputBlock,
    type BetaBashCodeExecutionOutputBlockParam as BetaBashCodeExecutionOutputBlockParam,
    type BetaBashCodeExecutionResultBlock as BetaBashCodeExecutionResultBlock,
    type BetaBashCodeExecutionResultBlockParam as BetaBashCodeExecutionResultBlockParam,
    type BetaBashCodeExecutionToolResultBlock as BetaBashCodeExecutionToolResultBlock,
    type BetaBashCodeExecutionToolResultBlockParam as BetaBashCodeExecutionToolResultBlockParam,
    type BetaBashCodeExecutionToolResultError as BetaBashCodeExecutionToolResultError,
    type BetaBashCodeExecutionToolResultErrorParam as BetaBashCodeExecutionToolResultErrorParam,
    type BetaCacheControlEphemeral as BetaCacheControlEphemeral,
    type BetaCacheCreation as BetaCacheCreation,
    type BetaCitationCharLocation as BetaCitationCharLocation,
    type BetaCitationCharLocationParam as BetaCitationCharLocationParam,
    type BetaCitationConfig as BetaCitationConfig,
    type BetaCitationContentBlockLocation as BetaCitationContentBlockLocation,
    type BetaCitationContentBlockLocationParam as BetaCitationContentBlockLocationParam,
    type BetaCitationPageLocation as BetaCitationPageLocation,
    type BetaCitationPageLocationParam as BetaCitationPageLocationParam,
    type BetaCitationSearchResultLocation as BetaCitationSearchResultLocation,
    type BetaCitationSearchResultLocationParam as BetaCitationSearchResultLocationParam,
    type BetaCitationWebSearchResultLocationParam as BetaCitationWebSearchResultLocationParam,
    type BetaCitationsConfigParam as BetaCitationsConfigParam,
    type BetaCitationsDelta as BetaCitationsDelta,
    type BetaCitationsWebSearchResultLocation as BetaCitationsWebSearchResultLocation,
    type BetaClearThinking20251015Edit as BetaClearThinking20251015Edit,
    type BetaClearThinking20251015EditResponse as BetaClearThinking20251015EditResponse,
    type BetaClearToolUses20250919Edit as BetaClearToolUses20250919Edit,
    type BetaClearToolUses20250919EditResponse as BetaClearToolUses20250919EditResponse,
    type BetaCodeExecutionOutputBlock as BetaCodeExecutionOutputBlock,
    type BetaCodeExecutionOutputBlockParam as BetaCodeExecutionOutputBlockParam,
    type BetaCodeExecutionResultBlock as BetaCodeExecutionResultBlock,
    type BetaCodeExecutionResultBlockParam as BetaCodeExecutionResultBlockParam,
    type BetaCodeExecutionTool20250522 as BetaCodeExecutionTool20250522,
    type BetaCodeExecutionTool20250825 as BetaCodeExecutionTool20250825,
    type BetaCodeExecutionTool20260120 as BetaCodeExecutionTool20260120,
    type BetaCodeExecutionToolResultBlock as BetaCodeExecutionToolResultBlock,
    type BetaCodeExecutionToolResultBlockContent as BetaCodeExecutionToolResultBlockContent,
    type BetaCodeExecutionToolResultBlockParam as BetaCodeExecutionToolResultBlockParam,
    type BetaCodeExecutionToolResultBlockParamContent as BetaCodeExecutionToolResultBlockParamContent,
    type BetaCodeExecutionToolResultError as BetaCodeExecutionToolResultError,
    type BetaCodeExecutionToolResultErrorCode as BetaCodeExecutionToolResultErrorCode,
    type BetaCodeExecutionToolResultErrorParam as BetaCodeExecutionToolResultErrorParam,
    type BetaCompact20260112Edit as BetaCompact20260112Edit,
    type BetaCompactionBlock as BetaCompactionBlock,
    type BetaCompactionBlockParam as BetaCompactionBlockParam,
    type BetaCompactionContentBlockDelta as BetaCompactionContentBlockDelta,
    type BetaCompactionIterationUsage as BetaCompactionIterationUsage,
    type BetaContainer as BetaContainer,
    type BetaContainerParams as BetaContainerParams,
    type BetaContainerUploadBlock as BetaContainerUploadBlock,
    type BetaContainerUploadBlockParam as BetaContainerUploadBlockParam,
    type BetaContentBlock as BetaContentBlock,
    type BetaContentBlockParam as BetaContentBlockParam,
    type BetaContentBlockSource as BetaContentBlockSource,
    type BetaContentBlockSourceContent as BetaContentBlockSourceContent,
    type BetaContextManagementConfig as BetaContextManagementConfig,
    type BetaContextManagementResponse as BetaContextManagementResponse,
    type BetaCountTokensContextManagementResponse as BetaCountTokensContextManagementResponse,
    type BetaDirectCaller as BetaDirectCaller,
    type BetaDocumentBlock as BetaDocumentBlock,
    type BetaEncryptedCodeExecutionResultBlock as BetaEncryptedCodeExecutionResultBlock,
    type BetaEncryptedCodeExecutionResultBlockParam as BetaEncryptedCodeExecutionResultBlockParam,
    type BetaFileDocumentSource as BetaFileDocumentSource,
    type BetaFileImageSource as BetaFileImageSource,
    type BetaImageBlockParam as BetaImageBlockParam,
    type BetaInputJSONDelta as BetaInputJSONDelta,
    type BetaJSONOutputFormat as BetaJSONOutputFormat,
    type BetaInputTokensClearAtLeast as BetaInputTokensClearAtLeast,
    type BetaInputTokensTrigger as BetaInputTokensTrigger,
    type BetaMCPToolConfig as BetaMCPToolConfig,
    type BetaMCPToolDefaultConfig as BetaMCPToolDefaultConfig,
    type BetaMCPToolResultBlock as BetaMCPToolResultBlock,
    type BetaMCPToolUseBlock as BetaMCPToolUseBlock,
    type BetaMCPToolUseBlockParam as BetaMCPToolUseBlockParam,
    type BetaMCPToolset as BetaMCPToolset,
    type BetaMemoryTool20250818 as BetaMemoryTool20250818,
    type BetaMemoryTool20250818Command as BetaMemoryTool20250818Command,
    type BetaMemoryTool20250818CreateCommand as BetaMemoryTool20250818CreateCommand,
    type BetaMemoryTool20250818DeleteCommand as BetaMemoryTool20250818DeleteCommand,
    type BetaMemoryTool20250818InsertCommand as BetaMemoryTool20250818InsertCommand,
    type BetaMemoryTool20250818RenameCommand as BetaMemoryTool20250818RenameCommand,
    type BetaMemoryTool20250818StrReplaceCommand as BetaMemoryTool20250818StrReplaceCommand,
    type BetaMemoryTool20250818ViewCommand as BetaMemoryTool20250818ViewCommand,
    type BetaMessage as BetaMessage,
    type BetaMessageDeltaUsage as BetaMessageDeltaUsage,
    type BetaMessageIterationUsage as BetaMessageIterationUsage,
    type BetaMessageParam as BetaMessageParam,
    type BetaMessageTokensCount as BetaMessageTokensCount,
    type BetaMetadata as BetaMetadata,
    type BetaOutputConfig as BetaOutputConfig,
    type BetaPlainTextSource as BetaPlainTextSource,
    type BetaRawContentBlockDelta as BetaRawContentBlockDelta,
    type BetaRawContentBlockDeltaEvent as BetaRawContentBlockDeltaEvent,
    type BetaRawContentBlockStartEvent as BetaRawContentBlockStartEvent,
    type BetaRawContentBlockStopEvent as BetaRawContentBlockStopEvent,
    type BetaRawMessageDeltaEvent as BetaRawMessageDeltaEvent,
    type BetaRawMessageStartEvent as BetaRawMessageStartEvent,
    type BetaRawMessageStopEvent as BetaRawMessageStopEvent,
    type BetaRawMessageStreamEvent as BetaRawMessageStreamEvent,
    type BetaRedactedThinkingBlock as BetaRedactedThinkingBlock,
    type BetaRedactedThinkingBlockParam as BetaRedactedThinkingBlockParam,
    type BetaRefusalStopDetails as BetaRefusalStopDetails,
    type BetaRequestDocumentBlock as BetaRequestDocumentBlock,
    type BetaRequestMCPServerToolConfiguration as BetaRequestMCPServerToolConfiguration,
    type BetaRequestMCPServerURLDefinition as BetaRequestMCPServerURLDefinition,
    type BetaRequestMCPToolResultBlockParam as BetaRequestMCPToolResultBlockParam,
    type BetaSearchResultBlockParam as BetaSearchResultBlockParam,
    type BetaServerToolCaller as BetaServerToolCaller,
    type BetaServerToolCaller20260120 as BetaServerToolCaller20260120,
    type BetaServerToolUsage as BetaServerToolUsage,
    type BetaServerToolUseBlock as BetaServerToolUseBlock,
    type BetaServerToolUseBlockParam as BetaServerToolUseBlockParam,
    type BetaSignatureDelta as BetaSignatureDelta,
    type BetaSkill as BetaSkill,
    type BetaSkillParams as BetaSkillParams,
    type BetaStopReason as BetaStopReason,
    type BetaTextBlock as BetaTextBlock,
    type BetaTextBlockParam as BetaTextBlockParam,
    type BetaTextCitation as BetaTextCitation,
    type BetaTextCitationParam as BetaTextCitationParam,
    type BetaTextDelta as BetaTextDelta,
    type BetaTextEditorCodeExecutionCreateResultBlock as BetaTextEditorCodeExecutionCreateResultBlock,
    type BetaTextEditorCodeExecutionCreateResultBlockParam as BetaTextEditorCodeExecutionCreateResultBlockParam,
    type BetaTextEditorCodeExecutionStrReplaceResultBlock as BetaTextEditorCodeExecutionStrReplaceResultBlock,
    type BetaTextEditorCodeExecutionStrReplaceResultBlockParam as BetaTextEditorCodeExecutionStrReplaceResultBlockParam,
    type BetaTextEditorCodeExecutionToolResultBlock as BetaTextEditorCodeExecutionToolResultBlock,
    type BetaTextEditorCodeExecutionToolResultBlockParam as BetaTextEditorCodeExecutionToolResultBlockParam,
    type BetaTextEditorCodeExecutionToolResultError as BetaTextEditorCodeExecutionToolResultError,
    type BetaTextEditorCodeExecutionToolResultErrorParam as BetaTextEditorCodeExecutionToolResultErrorParam,
    type BetaTextEditorCodeExecutionViewResultBlock as BetaTextEditorCodeExecutionViewResultBlock,
    type BetaTextEditorCodeExecutionViewResultBlockParam as BetaTextEditorCodeExecutionViewResultBlockParam,
    type BetaThinkingBlock as BetaThinkingBlock,
    type BetaThinkingBlockParam as BetaThinkingBlockParam,
    type BetaThinkingConfigAdaptive as BetaThinkingConfigAdaptive,
    type BetaThinkingConfigDisabled as BetaThinkingConfigDisabled,
    type BetaThinkingConfigEnabled as BetaThinkingConfigEnabled,
    type BetaThinkingConfigParam as BetaThinkingConfigParam,
    type BetaThinkingDelta as BetaThinkingDelta,
    type BetaThinkingTurns as BetaThinkingTurns,
    type BetaTool as BetaTool,
    type BetaToolBash20241022 as BetaToolBash20241022,
    type BetaToolBash20250124 as BetaToolBash20250124,
    type BetaToolChoice as BetaToolChoice,
    type BetaToolChoiceAny as BetaToolChoiceAny,
    type BetaToolChoiceAuto as BetaToolChoiceAuto,
    type BetaToolChoiceNone as BetaToolChoiceNone,
    type BetaToolChoiceTool as BetaToolChoiceTool,
    type BetaToolComputerUse20241022 as BetaToolComputerUse20241022,
    type BetaToolComputerUse20250124 as BetaToolComputerUse20250124,
    type BetaToolComputerUse20251124 as BetaToolComputerUse20251124,
    type BetaToolReferenceBlock as BetaToolReferenceBlock,
    type BetaToolReferenceBlockParam as BetaToolReferenceBlockParam,
    type BetaToolResultBlockParam as BetaToolResultBlockParam,
    type BetaToolTextEditor20241022 as BetaToolTextEditor20241022,
    type BetaToolTextEditor20250124 as BetaToolTextEditor20250124,
    type BetaToolTextEditor20250429 as BetaToolTextEditor20250429,
    type BetaToolTextEditor20250728 as BetaToolTextEditor20250728,
    type BetaToolUnion as BetaToolUnion,
    type BetaToolUseBlock as BetaToolUseBlock,
    type BetaToolUseBlockParam as BetaToolUseBlockParam,
    type BetaToolUsesKeep as BetaToolUsesKeep,
    type BetaToolUsesTrigger as BetaToolUsesTrigger,
    type BetaURLImageSource as BetaURLImageSource,
    type BetaURLPDFSource as BetaURLPDFSource,
    type BetaUsage as BetaUsage,
    type BetaUserLocation as BetaUserLocation,
    type BetaWebFetchBlock as BetaWebFetchBlock,
    type BetaWebFetchBlockParam as BetaWebFetchBlockParam,
    type BetaWebFetchTool20250910 as BetaWebFetchTool20250910,
    type BetaWebFetchTool20260209 as BetaWebFetchTool20260209,
    type BetaWebFetchTool20260309 as BetaWebFetchTool20260309,
    type BetaWebFetchToolResultBlock as BetaWebFetchToolResultBlock,
    type BetaWebFetchToolResultBlockParam as BetaWebFetchToolResultBlockParam,
    type BetaWebFetchToolResultErrorBlock as BetaWebFetchToolResultErrorBlock,
    type BetaWebFetchToolResultErrorBlockParam as BetaWebFetchToolResultErrorBlockParam,
    type BetaWebFetchToolResultErrorCode as BetaWebFetchToolResultErrorCode,
    type BetaWebSearchResultBlock as BetaWebSearchResultBlock,
    type BetaWebSearchResultBlockParam as BetaWebSearchResultBlockParam,
    type BetaWebSearchTool20250305 as BetaWebSearchTool20250305,
    type BetaWebSearchTool20260209 as BetaWebSearchTool20260209,
    type BetaWebSearchToolRequestError as BetaWebSearchToolRequestError,
    type BetaWebSearchToolResultBlock as BetaWebSearchToolResultBlock,
    type BetaWebSearchToolResultBlockContent as BetaWebSearchToolResultBlockContent,
    type BetaWebSearchToolResultBlockParam as BetaWebSearchToolResultBlockParam,
    type BetaWebSearchToolResultBlockParamContent as BetaWebSearchToolResultBlockParamContent,
    type BetaWebSearchToolResultError as BetaWebSearchToolResultError,
    type BetaWebSearchToolResultErrorCode as BetaWebSearchToolResultErrorCode,
    type BetaBase64PDFBlock as BetaBase64PDFBlock,
    type MessageCreateParams as MessageCreateParams,
    type MessageCreateParamsNonStreaming as MessageCreateParamsNonStreaming,
    type MessageCreateParamsStreaming as MessageCreateParamsStreaming,
    type MessageCountTokensParams as MessageCountTokensParams,
  };

  export {
    Agents as Agents,
    type BetaManagedAgentsAgent as BetaManagedAgentsAgent,
    type BetaManagedAgentsAgentToolConfig as BetaManagedAgentsAgentToolConfig,
    type BetaManagedAgentsAgentToolConfigParams as BetaManagedAgentsAgentToolConfigParams,
    type BetaManagedAgentsAgentToolsetDefaultConfig as BetaManagedAgentsAgentToolsetDefaultConfig,
    type BetaManagedAgentsAgentToolsetDefaultConfigParams as BetaManagedAgentsAgentToolsetDefaultConfigParams,
    type BetaManagedAgentsAgentToolset20260401 as BetaManagedAgentsAgentToolset20260401,
    type BetaManagedAgentsAgentToolset20260401Params as BetaManagedAgentsAgentToolset20260401Params,
    type BetaManagedAgentsAlwaysAllowPolicy as BetaManagedAgentsAlwaysAllowPolicy,
    type BetaManagedAgentsAlwaysAskPolicy as BetaManagedAgentsAlwaysAskPolicy,
    type BetaManagedAgentsAnthropicSkill as BetaManagedAgentsAnthropicSkill,
    type BetaManagedAgentsAnthropicSkillParams as BetaManagedAgentsAnthropicSkillParams,
    type BetaManagedAgentsCustomSkill as BetaManagedAgentsCustomSkill,
    type BetaManagedAgentsCustomSkillParams as BetaManagedAgentsCustomSkillParams,
    type BetaManagedAgentsCustomTool as BetaManagedAgentsCustomTool,
    type BetaManagedAgentsCustomToolInputSchema as BetaManagedAgentsCustomToolInputSchema,
    type BetaManagedAgentsCustomToolParams as BetaManagedAgentsCustomToolParams,
    type BetaManagedAgentsMCPServerURLDefinition as BetaManagedAgentsMCPServerURLDefinition,
    type BetaManagedAgentsMCPToolConfig as BetaManagedAgentsMCPToolConfig,
    type BetaManagedAgentsMCPToolConfigParams as BetaManagedAgentsMCPToolConfigParams,
    type BetaManagedAgentsMCPToolset as BetaManagedAgentsMCPToolset,
    type BetaManagedAgentsMCPToolsetDefaultConfig as BetaManagedAgentsMCPToolsetDefaultConfig,
    type BetaManagedAgentsMCPToolsetDefaultConfigParams as BetaManagedAgentsMCPToolsetDefaultConfigParams,
    type BetaManagedAgentsMCPToolsetParams as BetaManagedAgentsMCPToolsetParams,
    type BetaManagedAgentsModel as BetaManagedAgentsModel,
    type BetaManagedAgentsModelConfig as BetaManagedAgentsModelConfig,
    type BetaManagedAgentsModelConfigParams as BetaManagedAgentsModelConfigParams,
    type BetaManagedAgentsSkillParams as BetaManagedAgentsSkillParams,
    type BetaManagedAgentsURLMCPServerParams as BetaManagedAgentsURLMCPServerParams,
    type BetaManagedAgentsAgentsPageCursor as BetaManagedAgentsAgentsPageCursor,
    type AgentCreateParams as AgentCreateParams,
    type AgentRetrieveParams as AgentRetrieveParams,
    type AgentUpdateParams as AgentUpdateParams,
    type AgentListParams as AgentListParams,
    type AgentArchiveParams as AgentArchiveParams,
  };

  export {
    Environments as Environments,
    type BetaCloudConfig as BetaCloudConfig,
    type BetaCloudConfigParams as BetaCloudConfigParams,
    type BetaEnvironment as BetaEnvironment,
    type BetaEnvironmentDeleteResponse as BetaEnvironmentDeleteResponse,
    type BetaLimitedNetwork as BetaLimitedNetwork,
    type BetaLimitedNetworkParams as BetaLimitedNetworkParams,
    type BetaPackages as BetaPackages,
    type BetaPackagesParams as BetaPackagesParams,
    type BetaUnrestrictedNetwork as BetaUnrestrictedNetwork,
    type BetaEnvironmentsPageCursor as BetaEnvironmentsPageCursor,
    type EnvironmentCreateParams as EnvironmentCreateParams,
    type EnvironmentRetrieveParams as EnvironmentRetrieveParams,
    type EnvironmentUpdateParams as EnvironmentUpdateParams,
    type EnvironmentListParams as EnvironmentListParams,
    type EnvironmentDeleteParams as EnvironmentDeleteParams,
    type EnvironmentArchiveParams as EnvironmentArchiveParams,
  };

  export {
    Sessions as Sessions,
    type BetaManagedAgentsAgentParams as BetaManagedAgentsAgentParams,
    type BetaManagedAgentsBranchCheckout as BetaManagedAgentsBranchCheckout,
    type BetaManagedAgentsCacheCreationUsage as BetaManagedAgentsCacheCreationUsage,
    type BetaManagedAgentsCommitCheckout as BetaManagedAgentsCommitCheckout,
    type BetaManagedAgentsDeletedSession as BetaManagedAgentsDeletedSession,
    type BetaManagedAgentsFileResourceParams as BetaManagedAgentsFileResourceParams,
    type BetaManagedAgentsGitHubRepositoryResourceParams as BetaManagedAgentsGitHubRepositoryResourceParams,
    type BetaManagedAgentsSession as BetaManagedAgentsSession,
    type BetaManagedAgentsSessionAgent as BetaManagedAgentsSessionAgent,
    type BetaManagedAgentsSessionStats as BetaManagedAgentsSessionStats,
    type BetaManagedAgentsSessionUsage as BetaManagedAgentsSessionUsage,
    type BetaManagedAgentsSessionsPageCursor as BetaManagedAgentsSessionsPageCursor,
    type SessionCreateParams as SessionCreateParams,
    type SessionRetrieveParams as SessionRetrieveParams,
    type SessionUpdateParams as SessionUpdateParams,
    type SessionListParams as SessionListParams,
    type SessionDeleteParams as SessionDeleteParams,
    type SessionArchiveParams as SessionArchiveParams,
  };

  export {
    Vaults as Vaults,
    type BetaManagedAgentsDeletedVault as BetaManagedAgentsDeletedVault,
    type BetaManagedAgentsVault as BetaManagedAgentsVault,
    type BetaManagedAgentsVaultsPageCursor as BetaManagedAgentsVaultsPageCursor,
    type VaultCreateParams as VaultCreateParams,
    type VaultRetrieveParams as VaultRetrieveParams,
    type VaultUpdateParams as VaultUpdateParams,
    type VaultListParams as VaultListParams,
    type VaultDeleteParams as VaultDeleteParams,
    type VaultArchiveParams as VaultArchiveParams,
  };

  export {
    Files as Files,
    type BetaFileScope as BetaFileScope,
    type DeletedFile as DeletedFile,
    type FileMetadata as FileMetadata,
    type FileMetadataPage as FileMetadataPage,
    type FileListParams as FileListParams,
    type FileDeleteParams as FileDeleteParams,
    type FileDownloadParams as FileDownloadParams,
    type FileRetrieveMetadataParams as FileRetrieveMetadataParams,
    type FileUploadParams as FileUploadParams,
  };

  export {
    Skills as Skills,
    type SkillCreateResponse as SkillCreateResponse,
    type SkillRetrieveResponse as SkillRetrieveResponse,
    type SkillListResponse as SkillListResponse,
    type SkillDeleteResponse as SkillDeleteResponse,
    type SkillListResponsesPageCursor as SkillListResponsesPageCursor,
    type SkillCreateParams as SkillCreateParams,
    type SkillRetrieveParams as SkillRetrieveParams,
    type SkillListParams as SkillListParams,
    type SkillDeleteParams as SkillDeleteParams,
  };
}
