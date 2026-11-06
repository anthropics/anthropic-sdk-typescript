import { propagation } from '@opentelemetry/api';
import { defaultLogger } from './utils/log';

/**
 * The names, in lower case, of the headers that carry a trace context: those of W3C Trace Context
 * and Baggage, and any other that the propagator the application registered writes. An HTTP
 * instrumentation may add to them or replace them after a request is signed, so a signature must not
 * cover them. A propagator that fails to list its fields adds none.
 */
export function traceHeaderNames(): Set<string> {
  const names = new Set(['traceparent', 'tracestate', 'baggage']);
  try {
    for (const name of propagation.fields()) {
      names.add(name.toLowerCase());
    }
  } catch (problem) {
    // A signer calls this with no client at hand.
    defaultLogger().debug('could not record telemetry', problem);
  }
  return names;
}
