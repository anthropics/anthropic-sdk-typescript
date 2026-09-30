import { APIResource } from '../../../../../core/resource';
import * as ChatAPI from './chat/chat';
import { Chat } from './chat/chat';

export class Apps extends APIResource {
  chat: ChatAPI.Chat = new ChatAPI.Chat(this._client);
}

Apps.Chat = Chat;

export declare namespace Apps {
  export { Chat as Chat };
}
