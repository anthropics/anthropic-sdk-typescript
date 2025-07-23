#!/usr/bin/env -S npm run tsn -T

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const client = new Anthropic(); // gets API Key from environment variable ANTHROPIC_API_KEY
async function main() {
  const filePath = path.join(__dirname, 'logo.png');
  const buffer = fs.readFileSync(filePath);
  const base64Image = buffer.toString('base64');
  const result = await client.messages.create({
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What is in this image?',
          },
          {
            type: 'image',
            source: {
              data: base64Image,
              type: 'base64',
              media_type: 'image/png',
            },
          },
        ],
      },
    ],
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
  });
  console.dir(result);
}

main();
