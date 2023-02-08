import { fetchEventSource } from "@fortaine/fetch-event-source";
import fetch from "cross-fetch";

export type SamplingParameters = {
  prompt: string;
  model: string;
  stop_sequences: string[];
  max_tokens_to_sample: number;
};

export type OnOpen = (response: Response) => void | Promise<void>;
export type OnUpdate = (completion: CompletionResponse) => void | Promise<void>;

export const HUMAN_PROMPT = "\n\nHuman:";
export const AI_PROMPT = "\n\nAssistant:";

const CLIENT_ID = "anthropic-typescript/0.4.0";
const DEFAULT_API_URL = "https://api.anthropic.com";

enum Event {
  Ping = "ping",
}

export type CompletionResponse = {
  completion: string;
  stop: string | null;
  stop_reason: string | null;
  truncated: boolean;
  exception: string | null;
  log_id: string;
};

export class Client {
  private apiUrl: string;

  constructor(private apiKey: string, options?: { apiUrl?: string }) {
    this.apiUrl = options?.apiUrl ?? DEFAULT_API_URL;
  }

  async complete(params: SamplingParameters): Promise<CompletionResponse> {
    const response = await fetch(`${this.apiUrl}/v1/complete`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Client: CLIENT_ID,
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = new Error(
        `Sampling error: ${response.status} ${response.statusText}`
      );
      console.error(error);
      throw error;
    }

    const completion = (await response.json()) as CompletionResponse;
    return completion;
  }

  completeStream(
    params: SamplingParameters,
    { onOpen, onUpdate }: { onOpen?: OnOpen; onUpdate?: OnUpdate }
  ): Promise<CompletionResponse> {
    const abortController = new AbortController();
    return new Promise((resolve, reject) => {
      fetchEventSource(`${this.apiUrl}/v1/complete`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Client: CLIENT_ID,
          "X-API-Key": this.apiKey,
        },
        body: JSON.stringify({
          ...params,
          stream: true,
        }),
        signal: abortController.signal,
        onopen: async (response) => {
          if (!response.ok) {
            abortController.abort();
            return reject(
              Error(
                `Failed to open sampling stream, HTTP status code ${response.status}: ${response.statusText}`
              )
            );
          }

          if (onOpen) {
            await Promise.resolve(onOpen(response));
          }
        },
        onmessage: (ev) => {
          if (ev.event === Event.Ping) {
            return;
          }

          const completion = JSON.parse(ev.data) as CompletionResponse;
          if (completion.stop_reason !== null) {
            abortController.abort();
            return resolve(completion);
          }

          if (onUpdate) {
            Promise.resolve(onUpdate(completion)).catch((error) => {
              abortController.abort();
              reject(error);
            });
          }
        },
        onerror: (error) => {
          console.error("Sampling error:", error);
          abortController.abort();
          return reject(error);
        },
      });
    });
  }
}
