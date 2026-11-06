import { context, trace, SpanKind, SpanStatusCode, type Context, type Span } from '@opentelemetry/api';
import type { BaseAnthropic } from '../../../client';
import { SDK_HELPER_SYMBOL, wasCreatedByStainlessHelper } from '../../../internal/stainless-helper-header';
import { guardTracing, setErrorStatus } from '../../../internal/tracing';
import { loggerFor } from '../../../internal/utils/log';
import type { BetaRunnableTool, BetaToolUse } from '../../tools/BetaRunnableTool';
import type { BetaRunnableToolset } from '../../tools/BetaRunnableToolset';
import type { MessageCreateParams as BetaMessageCreateParams } from '../../../resources/beta/messages/messages';
import {
  ATTR_ANTHROPIC_TOOL_RESULT_CONTENT,
  ATTR_ANTHROPIC_TOOLSET_NAME,
  ATTR_GEN_AI_CONVERSATION_ID,
  ATTR_GEN_AI_OPERATION_NAME,
  ATTR_GEN_AI_OUTPUT_TYPE,
  ATTR_GEN_AI_PROVIDER_NAME,
  ATTR_GEN_AI_REQUEST_MODEL,
  ATTR_GEN_AI_TOOL_CALL_ARGUMENTS,
  ATTR_GEN_AI_TOOL_CALL_ID,
  ATTR_GEN_AI_TOOL_DESCRIPTION,
  ATTR_GEN_AI_TOOL_NAME,
  ATTR_GEN_AI_TOOL_TYPE,
  GEN_AI_OPERATION_NAME_VALUE_EXECUTE_TOOL,
  GEN_AI_OPERATION_NAME_VALUE_INVOKE_AGENT,
  GEN_AI_OUTPUT_TYPE_VALUE_JSON,
  GEN_AI_TOOL_TYPE_VALUE_FUNCTION,
} from './attributes';
import { setContentAttributes, toolResultContentBlocks } from './content';
import type { AnyToolResultContent } from './types';

/**
 * Starts the `anthropic.messages.tool_runner` span of one loop of the Messages tool runner, as a
 * child of the current span. The runner sets its status and ends it.
 */
export function startToolRunnerSpan(
  client: BaseAnthropic,
  params: Pick<BetaMessageCreateParams, 'model' | 'output_config' | 'output_format'>,
  conversationId: string | undefined,
): Span | undefined {
  // A client whose spans are disabled computes nothing for one.
  if (!client._tracer) return undefined;
  const hasJSONOutput =
    params.output_config?.format?.type === 'json_schema' || params.output_format?.type === 'json_schema';
  return client._tracer.startSpan('anthropic.messages.tool_runner', {
    kind: SpanKind.INTERNAL,
    attributes: {
      [ATTR_GEN_AI_OPERATION_NAME]: GEN_AI_OPERATION_NAME_VALUE_INVOKE_AGENT,
      [ATTR_GEN_AI_PROVIDER_NAME]: client._genAIProviderName,
      [ATTR_GEN_AI_REQUEST_MODEL]: params.model,
      ...(hasJSONOutput ? { [ATTR_GEN_AI_OUTPUT_TYPE]: GEN_AI_OUTPUT_TYPE_VALUE_JSON } : undefined),
      ...(conversationId != null ? { [ATTR_GEN_AI_CONVERSATION_ID]: conversationId } : undefined),
    },
  });
}

/** What a tool runner says of itself for the spans of the tools it runs. */
export interface ToolUseSpanOptions {
  /** The application's abort signal: a run that it aborts is canceled, not failed. */
  signal?: AbortSignal | null | undefined;
  /**
   * The conversation ID that the application set on the tool runner. Without one, the Sessions
   * tool runner gives the ID of the Session thread that the tool call belongs to, when it knows it.
   */
  conversationId?: string | undefined;
  /** For the Sessions tool runner, the ID of the Session that the tool call belongs to. */
  sessionID?: string | undefined;
  /**
   * The span's parent, which the tool runner holds because a context manager that does not follow
   * promises has lost it by the time a tool runs. The default is the current context.
   */
  parentContext?: Context | undefined;
}

/** What a tool runner sends back for a tool run. */
interface ToolUseResult {
  content: NonNullable<AnyToolResultContent>;
  isError: boolean;
}

/**
 * Runs `run`, one client tool run of a tool runner, with the run's span current, and returns its
 * result. An error result fails the span with `tool_error`, unless the application has aborted
 * `signal`: a canceled run gets no status and no result.
 */
export async function withToolUseSpan<Result extends ToolUseResult>(
  client: BaseAnthropic,
  tool: BetaRunnableTool | BetaRunnableToolset,
  toolUse: BetaToolUse,
  options: ToolUseSpanOptions,
  run: () => Promise<Result>,
): Promise<Result> {
  // A client whose spans are disabled computes nothing for one.
  const tracer = client._tracer;
  if (!tracer) return run();
  const { signal, conversationId, sessionID, parentContext = context.active() } = options;
  // Only a tool that the application or an MCP server defines has a description. It is not content.
  const description = 'description' in tool ? tool.description : undefined;
  const attributes = {
    [ATTR_GEN_AI_OPERATION_NAME]: GEN_AI_OPERATION_NAME_VALUE_EXECUTE_TOOL,
    [ATTR_GEN_AI_PROVIDER_NAME]: client._genAIProviderName,
    [ATTR_GEN_AI_TOOL_NAME]: toolUse.name,
    // Only a call to a member of a toolset, such as `computer`, has one.
    ...('toolset_name' in toolUse && typeof toolUse.toolset_name === 'string' ?
      { [ATTR_ANTHROPIC_TOOLSET_NAME]: toolUse.toolset_name }
    : undefined),
    ...(description ? { [ATTR_GEN_AI_TOOL_DESCRIPTION]: description } : undefined),
    [ATTR_GEN_AI_TOOL_CALL_ID]: toolUse.id,
    [ATTR_GEN_AI_TOOL_TYPE]: GEN_AI_TOOL_TYPE_VALUE_FUNCTION,
    ...(conversationId != null ? { [ATTR_GEN_AI_CONVERSATION_ID]: conversationId } : undefined),
    ...(sessionID != null ? { 'anthropic.session.id': sessionID } : undefined),
    // Only a Session event of a child thread has one.
    ...('session_thread_id' in toolUse && toolUse.session_thread_id != null ?
      { 'anthropic.session.thread.id': toolUse.session_thread_id }
    : undefined),
  };
  const operation =
    toolUse.type === 'agent.tool_use' ? 'anthropic.tool_use'
    : wasCreatedByStainlessHelper(tool) && tool[SDK_HELPER_SYMBOL] === 'mcpTool' ? 'anthropic.mcp_tool_use'
    : 'anthropic.custom_tool_use';
  const span = guardTracing(client, () =>
    tracer.startSpan(`${operation} ${toolUse.name}`, { kind: SpanKind.INTERNAL, attributes }, parentContext),
  );
  if (!span) return run();

  let result: Result | undefined;
  try {
    result = await context.with(trace.setSpan(parentContext, span), run);
    return result;
  } finally {
    // `run` makes an error result of what the tool throws, so no result is the runner's own failure.
    const succeeded = result !== undefined && !result.isError;
    const canceled = !succeeded && signal?.aborted === true;
    const { contentMode, maxContentBytes } = client.openTelemetry.traces;
    if (contentMode === 'content' && span.isRecording()) {
      try {
        setContentAttributes(
          span,
          {
            [ATTR_GEN_AI_TOOL_CALL_ARGUMENTS]: toolUse.input,
            [ATTR_ANTHROPIC_TOOL_RESULT_CONTENT]:
              result && !canceled ? toolResultContentBlocks(result.content) : undefined,
          },
          maxContentBytes,
        );
      } catch (problem) {
        // A failure to record telemetry, such as content that JSON cannot hold, must not fail the run.
        loggerFor(client).debug('could not record the tool run on its span', problem);
      }
    }
    guardTracing(client, () => {
      if (succeeded) {
        span.setStatus({ code: SpanStatusCode.OK });
      } else if (!canceled) {
        setErrorStatus(span, result, 'tool_error');
      }
      span.end();
    });
  }
}
