export type StreamingMessage = {
  completion: string;
  stop: string | null;
  stop_reason: string | null;
  truncated: boolean;
  exception: string | null;
  log_id: string;
};
