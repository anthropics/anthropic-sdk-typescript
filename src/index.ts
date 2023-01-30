import { fetchEventSource } from "@fortaine/fetch-event-source";

export type SamplingParameters = {
  prompt: string;
  model: string;
  stop_sequences: string[];
  max_tokens_to_sample: number;
};

export type OnSampleChange = (sample: string) => void | Promise<void>;

export const HUMAN_PROMPT = "\n\nHuman:";
export const AI_PROMPT = "\n\nAssistant:";

const CLIENT_ID = "anthropic-typescript/0.2.0";
const DEFAULT_API_URL = "https://api.anthropic.com";

enum Event {
  Ping = "ping",
}

type StreamingMessage = {
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

  completeStream(
    params: SamplingParameters,
    onSampleChange: OnSampleChange
  ): Promise<string> {
    const abortController = new AbortController();
    return new Promise((resolve, reject) => {
      fetchEventSource("https://api.anthropic.com/v1/complete", {
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
        },
        onmessage: (ev) => {
          if (ev.event === Event.Ping) {
            return;
          }

          const message = JSON.parse(ev.data) as StreamingMessage;
          if (message.stop_reason !== null) {
            abortController.abort();
            return resolve(message.completion);
          }

          if (onSampleChange) {
            Promise.resolve(onSampleChange(message.completion)).catch(
              (error) => {
                abortController.abort();
                reject(error);
              }
            );
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
