import { WorkloadIdentityError } from '@anthropic-ai/sdk/lib/credentials/types';
import {
  ToolsetClosedError,
  ToolsetConfigError,
  ToolsetContractError,
  ToolsetUsageError,
} from '@anthropic-ai/sdk/helpers/beta/toolsets';
import * as agentToolset from '@anthropic-ai/sdk/tools/agent-toolset/node';
import * as agentToolsetBrowser from '@anthropic-ai/sdk/tools/agent-toolset/node.browser';

test.each([
  ['WorkloadIdentityError', 'lib/credentials/types', new WorkloadIdentityError('boom')],
  ['ToolsetUsageError', 'helpers/beta/toolsets', new ToolsetUsageError('boom')],
  ['ToolsetConfigError', 'helpers/beta/toolsets', new ToolsetConfigError('boom')],
  ['ToolsetContractError', 'helpers/beta/toolsets', new ToolsetContractError('boom')],
  ['ToolsetClosedError', 'helpers/beta/toolsets', new ToolsetClosedError('boom')],
  ['SessionMemoryError', 'tools/agent-toolset/node', new agentToolset.SessionMemoryError('boom')],
  [
    'SessionMemoryError',
    'tools/agent-toolset/node.browser',
    new agentToolsetBrowser.SessionMemoryError('boom'),
  ],
  ['BashTimeoutError', 'tools/agent-toolset/node', new agentToolset.BashTimeoutError(200)],
  ['BashTimeoutError', 'tools/agent-toolset/node.browser', new agentToolsetBrowser.BashTimeoutError(200)],
])('%s from %s is named after its class', (className, _module, error) => {
  expect(error.name).toBe(className);
});
