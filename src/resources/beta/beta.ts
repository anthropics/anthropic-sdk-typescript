// File generated from our OpenAPI spec by Stainless.

import { APIResource } from '@anthropic-ai/sdk/resource';
import * as MessagesAPI from '@anthropic-ai/sdk/resources/beta/messages';

export class Beta extends APIResource {
  messages: MessagesAPI.Messages = new MessagesAPI.Messages(this._client);
}

export namespace Beta {
  export import Messages = MessagesAPI.Messages;
  export import ContentBlock = MessagesAPI.ContentBlock;
  export import ContentBlockDeltaEvent = MessagesAPI.ContentBlockDeltaEvent;
  export import ContentBlockStartEvent = MessagesAPI.ContentBlockStartEvent;
  export import ContentBlockStopEvent = MessagesAPI.ContentBlockStopEvent;
  export import Message = MessagesAPI.Message;
  export import MessageDeltaEvent = MessagesAPI.MessageDeltaEvent;
  export import MessageParam = MessagesAPI.MessageParam;
  export import MessageStartEvent = MessagesAPI.MessageStartEvent;
  export import MessageStopEvent = MessagesAPI.MessageStopEvent;
  export import MessageStreamEvent = MessagesAPI.MessageStreamEvent;
  export import TextBlock = MessagesAPI.TextBlock;
  export import TextDelta = MessagesAPI.TextDelta;
  export import MessageCreateParams = MessagesAPI.MessageCreateParams;
  export import MessageCreateParamsNonStreaming = MessagesAPI.MessageCreateParamsNonStreaming;
  export import MessageCreateParamsStreaming = MessagesAPI.MessageCreateParamsStreaming;
  export import MessageStreamParams = MessagesAPI.MessageStreamParams;
}
