export type CheckType =
    | 'CONTAINS'
    | 'MIN_LENGTH'
    | 'MAX_LENGTH'
    | 'DOES_NOT_CONTAIN'
    | 'REGEX_MATCH'
    | 'JSON_VALID'
    | 'HAS_STRUCTURE'
    | 'SENTIMENT'
    | 'TOXICITY'
    | 'PII_CHECK'
    | 'FACTUAL_ACCURACY'
    | 'LANGUAGE_MATCH'
    | 'PROMPT_INJECTION_CHECK'
    | 'VECTOR_SIMILARITY'
    | 'ROUGE_SCORE'
    | 'BLEU_SCORE'
    | 'CUSTOM_JS'
    | 'LATENCY'
    | 'COST';

export interface Check {
    type: CheckType;
    value: string | number | RegExp | object | boolean | number[];
    threshold?: number;
    options?: Record<string, any>;
}

export interface ClientConfig {
    apiKey: string;
    baseUrl?: string;
    opuzApiKey?: string;
    conversationId?: string;
}

export interface TraceMetadata {
    model?: string;
    usage?: any;
    duration?: number;
    stop_reason?: string;
    role?: string;
    type?: string;
    conversationId?: string;
}

export interface EvaluatorOptions {
    apiKey?: string;
    baseUrl?: string;
}