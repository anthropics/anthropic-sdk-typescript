import type { Check, CheckType } from "./types";

export default class CheckBuilder {
    private checks: Check[] = [];

    contains(text: string): this {
        this.checks.push({
            type: 'CONTAINS' as CheckType,
            value: text
        });
        return this;
    }

    minLength(length: number): this {
        this.checks.push({
            type: 'MIN_LENGTH' as CheckType,
            value: length
        });
        return this;
    }

    maxLength(length: number): this {
        this.checks.push({
            type: 'MAX_LENGTH' as CheckType,
            value: length
        });
        return this;
    }

    doesNotContain(text: string): this {
        this.checks.push({
            type: 'DOES_NOT_CONTAIN' as CheckType,
            value: text
        });
        return this;
    }

    matchesRegex(pattern: string): this {
        this.checks.push({
            type: 'REGEX_MATCH',
            value: pattern
        });
        return this;
    }

    isValidJson(): this {
        this.checks.push({
            type: 'JSON_VALID',
            value: true
        });
        return this;
    }

    hasStructure(structure: object): this {
        this.checks.push({
            type: 'HAS_STRUCTURE',
            value: structure
        });
        return this;
    }

    hasSentiment(expectedSentiment: 'positive' | 'negative' | 'neutral', threshold = 0.7): this {
        this.checks.push({
            type: 'SENTIMENT',
            value: expectedSentiment,
            threshold
        });
        return this;
    }

    noToxicity(threshold = 0.7): this {
        this.checks.push({
            type: 'TOXICITY',
            value: false,
            threshold
        });
        return this;
    }

    noPII(): this {
        this.checks.push({
            type: 'PII_CHECK',
            value: false
        });
        return this;
    }

    isFactuallyAccurate(facts: object): this {
        this.checks.push({
            type: 'FACTUAL_ACCURACY',
            value: facts
        });
        return this;
    }

    isInLanguage(language: string): this {
        this.checks.push({
            type: 'LANGUAGE_MATCH',
            value: language
        });
        return this;
    }

    noPromptInjection(): this {
        this.checks.push({
            type: 'PROMPT_INJECTION_CHECK',
            value: false
        });
        return this;
    }

    vectorSimilarity(embedding: number[], threshold = 0.8): this {
        this.checks.push({
            type: 'VECTOR_SIMILARITY',
            value: embedding,
            threshold
        });
        return this;
    }

    rougeScore(reference: string, threshold = 0.5): this {
        this.checks.push({
            type: 'ROUGE_SCORE',
            value: reference,
            threshold
        });
        return this;
    }

    bleuScore(references: string[], threshold = 0.5): this {
        this.checks.push({
            type: 'BLEU_SCORE',
            value: references,
            threshold
        });
        return this;
    }

    customJs(evaluationCode: string): this {
        this.checks.push({
            type: 'CUSTOM_JS',
            value: evaluationCode
        });
        return this;
    }

    maxLatency(milliseconds: number): this {
        this.checks.push({
            type: 'LATENCY',
            value: milliseconds
        });
        return this;
    }

    getChecks(): Check[] {
        return this.checks;
    }
}