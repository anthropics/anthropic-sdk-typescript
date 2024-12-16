import { Check } from './types';
import * as Core from './core';

interface ITrace {
    request: any; // TODO: fix this
    response: any; // TODO: fix this
    duration: number;
    checks: Check[];
}

export default class Opuz {
    private apiKey: string;

    constructor() {
        const key = Core.readEnv('OPUZ_API_KEY') ?? null;
        if (!key) {
            throw new Error('OPUZ_API_KEY is required. Set it in the environment or pass it in the config.');
        }
        this.apiKey = key;
    }

    getUrl(): string {
        if (Core.readEnv('NODE_ENV') === 'dev') {
            return 'http://localhost:3000/api/process';
        }
        return 'https://opuz.org/api/trace';
    }

    async trace(request: ITrace) {
        console.log('Tracing request:', request);
        try {
            const response = await fetch(this.getUrl(), {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request)
            });

            console.log('Response:', response);
        } catch (error) {
            console.error('Error tracing request:', error);
        }
    }
}
