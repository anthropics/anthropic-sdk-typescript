// Named as `@opentelemetry/semantic-conventions` names them, and copied: that package exports the
// `gen_ai.*` names only from its unstable `incubating` entry point, which says to copy them.
export const ATTR_GEN_AI_AGENT_ID = 'gen_ai.agent.id';
export { ATTR_GEN_AI_CONVERSATION_ID } from '../../../internal/tracing';
export const ATTR_GEN_AI_INPUT_MESSAGES = 'gen_ai.input.messages';
export const ATTR_GEN_AI_OPERATION_NAME = 'gen_ai.operation.name';
export const ATTR_GEN_AI_OUTPUT_MESSAGES = 'gen_ai.output.messages';
export const ATTR_GEN_AI_OUTPUT_TYPE = 'gen_ai.output.type';
export { ATTR_GEN_AI_PROVIDER_NAME } from '../../../internal/tracing';
export const ATTR_GEN_AI_REQUEST_MODEL = 'gen_ai.request.model';
export const ATTR_GEN_AI_REQUEST_STOP_SEQUENCES = 'gen_ai.request.stop_sequences';
export const ATTR_GEN_AI_RESPONSE_TIME_TO_FIRST_CHUNK = 'gen_ai.response.time_to_first_chunk';
export const ATTR_GEN_AI_SYSTEM_INSTRUCTIONS = 'gen_ai.system_instructions';
export const ATTR_GEN_AI_TOOL_CALL_ARGUMENTS = 'gen_ai.tool.call.arguments';
export const ATTR_GEN_AI_TOOL_CALL_ID = 'gen_ai.tool.call.id';
export const ATTR_GEN_AI_TOOL_DESCRIPTION = 'gen_ai.tool.description';
export const ATTR_GEN_AI_TOOL_NAME = 'gen_ai.tool.name';
export const ATTR_GEN_AI_TOOL_TYPE = 'gen_ai.tool.type';
export const ATTR_GEN_AI_USAGE_INPUT_TOKENS = 'gen_ai.usage.input_tokens';
export const GEN_AI_OPERATION_NAME_VALUE_EXECUTE_TOOL = 'execute_tool';
export const GEN_AI_OPERATION_NAME_VALUE_INVOKE_AGENT = 'invoke_agent';
export const GEN_AI_OUTPUT_TYPE_VALUE_JSON = 'json';
export const GEN_AI_TOOL_TYPE_VALUE_FUNCTION = 'function';

// This API's own attribute names, in the same style.
export const ATTR_ANTHROPIC_CONTENT_TRUNCATED = 'anthropic.content.truncated';
export const ATTR_ANTHROPIC_TOOL_RESULT_CONTENT = 'anthropic.tool_result.content';
export const ATTR_ANTHROPIC_TOOLSET_NAME = 'anthropic.toolset.name';
export const ATTR_ANTHROPIC_USAGE_COMPACTION_INPUT_TOKENS = 'anthropic.usage.compaction.input_tokens';
export const ATTR_ANTHROPIC_USAGE_COMPACTION_OUTPUT_TOKENS = 'anthropic.usage.compaction.output_tokens';
