// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '@anthropic-ai/sdk/resource';
import * as MessagesAPI from '@anthropic-ai/sdk/resources/beta/tools/messages';

export class Tools extends APIResource {
  messages: MessagesAPI.Messages = new MessagesAPI.Messages(this._client);
}

export namespace Tools {
  export import Messages = MessagesAPI.Messages;
  export import Tool = MessagesAPI.Tool;
  export import ToolResultBlockParam = MessagesAPI.ToolResultBlockParam;
  export import ToolUseBlock = MessagesAPI.ToolUseBlock;
  export import ToolUseBlockParam = MessagesAPI.ToolUseBlockParam;
  export import ToolsBetaContentBlock = MessagesAPI.ToolsBetaContentBlock;
  export import ToolsBetaMessage = MessagesAPI.ToolsBetaMessage;
  export import ToolsBetaMessageParam = MessagesAPI.ToolsBetaMessageParam;
  export import MessageCreateParams = MessagesAPI.MessageCreateParams;
  export import MessageCreateParamsNonStreaming = MessagesAPI.MessageCreateParamsNonStreaming;
  export import MessageCreateParamsStreaming = MessagesAPI.MessageCreateParamsStreaming;
}
