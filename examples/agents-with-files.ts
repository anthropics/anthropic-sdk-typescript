#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const client = new Anthropic();

async function main() {
  // Create an environment
  const environment = await client.beta.environments.create({
    name: 'files-example-environment',
  });
  console.log('Created environment:', environment.id);

  // Create an agent with the built-in toolset and an always-allow permission policy
  const agent = await client.beta.agents.create({
    name: 'files-example-agent',
    model: 'claude-sonnet-4-6',
    tools: [
      {
        type: 'agent_toolset_20260401',
        default_config: {
          enabled: true,
          permission_policy: { type: 'always_allow' },
        },
      },
    ],
  });
  console.log('Created agent:', agent.id);

  // Upload a file
  const file = await client.beta.files.upload({
    file: fs.createReadStream(path.join(__dirname, 'data.csv')),
  });
  console.log('Uploaded file:', file.id);

  // Create a session with the file mounted as a resource
  const session = await client.beta.sessions.create({
    environment_id: environment.id,
    agent: { type: 'agent', id: agent.id, version: agent.version },
    resources: [
      {
        type: 'file',
        file_id: file.id,
        mount_path: 'data.csv',
      },
    ],
  });
  console.log('Created session:', session.id);

  const resources = await client.beta.sessions.resources.list(session.id);
  console.log('Listed session resources:', resources.data);

  // Send a prompt asking the agent to read the mounted file and stream events
  console.log('Streaming events:');
  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: 'user.message',
        content: [
          {
            type: 'text',
            text: 'Read /uploads/data.csv and tell me the column names.',
          },
        ],
      },
    ],
  });

  const stream = await client.beta.sessions.events.stream(session.id);
  for await (const event of stream) {
    console.log(JSON.stringify(event, null, 2));
    if (event.type === 'session.status_idle') {
      break;
    }
  }
}

main();
