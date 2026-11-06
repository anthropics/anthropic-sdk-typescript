import type { ApiCallSpan } from '../../../internal/tracing';
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessage,
  BetaRawMessageStreamEvent,
  BetaToolResultBlockParam,
  MessageCreateParamsBase as BetaMessageCreateParamsBase,
} from '../../../resources/beta/messages/messages';
import type { BetaManagedAgentsUserCustomToolResultEventParams } from '../../../resources/beta/sessions/events';
import type {
  ContentBlock,
  ContentBlockParam,
  Message,
  MessageCreateParamsBase,
  RawMessageStreamEvent,
  ToolResultBlockParam,
} from '../../../resources/messages/messages';

// The Messages types that the spans record: the stable and beta forms share a span name.
export type MessageCreateBody = MessageCreateParamsBase | BetaMessageCreateParamsBase;
export type AnyMessage = Message | BetaMessage;
export type AnyStreamEvent = RawMessageStreamEvent | BetaRawMessageStreamEvent;
// The Sessions tool runner records a block that its result event holds as the block's JSON as the
// block itself, so its list has blocks of both kinds.
export type AnyToolResultContent =
  | (ToolResultBlockParam | BetaToolResultBlockParam)['content']
  | Array<
      | NonNullable<BetaManagedAgentsUserCustomToolResultEventParams['content']>[number]
      | Extract<BetaToolResultBlockParam['content'], unknown[]>[number]
    >;
export type AnyContentBlock = ContentBlock | ContentBlockParam | BetaContentBlock | BetaContentBlockParam;
export type AnyResultBlockContent = Extract<AnyContentBlock, { tool_use_id: string }>['content'];

/** The call span of a `messages.create` API call that a stream helper reads. */
export interface MessagesCreateSpan extends ApiCallSpan {
  /**
   * The request, and the Message that the helper builds from the events, from `message_start` on.
   * The span records the Message as far as it got when the stream ends before `message_stop`.
   */
  streamed?: { body: MessageCreateBody; message: AnyMessage } | undefined;
}
