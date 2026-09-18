import Anthropic from '@anthropic-ai/sdk';
import { debugLogRequestDetails, loggerFor } from '@anthropic-ai/sdk/internal/utils/log';

describe('debugLogRequestDetails', () => {
  const setup = (logLevel: 'debug' | 'info') => {
    const debug = vi.fn();
    const client = new Anthropic({
      apiKey: 'my-anthropic-api-key',
      logger: { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      logLevel,
    });
    let headerReads = 0;
    const headers = {
      get 'x-api-key'() {
        headerReads++;
        return 'secret';
      },
    };
    return { debug, logger: loggerFor(client), headers, headerReads: () => headerReads };
  };

  test('formats and logs the details when the level is debug', () => {
    const { debug, logger, headers, headerReads } = setup('debug');

    debugLogRequestDetails(logger, 'message', { headers, retryOfRequestLogID: 'log_1', status: 200 });

    expect(headerReads()).toBe(1);
    expect(debug).toHaveBeenCalledWith('message', {
      headers: { 'x-api-key': '***' },
      retryOf: 'log_1',
      status: 200,
    });
  });

  test('does not format the details when the level is above debug', () => {
    const { debug, logger, headers, headerReads } = setup('info');

    debugLogRequestDetails(logger, 'message', { headers, status: 200 });

    expect(headerReads()).toBe(0);
    expect(debug).not.toHaveBeenCalled();
  });
});
