// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { Webhook } from 'standardwebhooks';

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'my-anthropic-api-key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource webhooks', () => {
  test('unwrap', () => {
    const key = 'whsec_c2VjcmV0Cg==';
    const payload =
      '{"id":"whe_0f1e2d3c4b5a69788796a5b4c3d2e1f0","created_at":"2026-03-15T10:00:00Z","data":{"id":"sesn_011CZkZAtmR3yMPDzynEDxu7","organization_id":"org_011CZkZZAe0sMna4vkBdtrfx","type":"session.status_idled","workspace_id":"wrkspc_011CZkZaBF1tNoB5wlCeusgy"},"type":"event"}';
    const msgID = '1';
    const timestamp = new Date();
    const wh = new Webhook('whsec_c2VjcmV0Cg==');
    const signature = wh.sign(msgID, timestamp, payload);
    const headers: Record<string, string> = {
      'webhook-signature': signature,
      'webhook-id': msgID,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
    };
    client.beta.webhooks.unwrap(payload, { headers, key });
    client.withOptions({ webhookKey: key }).beta.webhooks.unwrap(payload, { headers });
    client.withOptions({ webhookKey: 'whsec_aaaaaaaaaa==' }).beta.webhooks.unwrap(payload, { headers, key });
    expect(() => {
      const wrongKey = 'whsec_aaaaaaaaaa==';
      client.beta.webhooks.unwrap(payload, { headers, key: wrongKey });
    }).toThrow('No matching signature found');
    expect(() => {
      const wrongKey = 'whsec_aaaaaaaaaa==';
      client.withOptions({ webhookKey: wrongKey }).beta.webhooks.unwrap(payload, { headers });
    }).toThrow('No matching signature found');
    expect(() => {
      const badSig = wh.sign(msgID, timestamp, 'some other payload');
      client.beta.webhooks.unwrap(payload, { headers: { ...headers, 'webhook-signature': badSig }, key });
    }).toThrow('No matching signature found');
    expect(() => {
      const badSig = wh.sign(msgID, timestamp, 'some other payload');
      client
        .withOptions({ webhookKey: key })
        .beta.webhooks.unwrap(payload, { headers: { ...headers, 'webhook-signature': badSig } });
    }).toThrow('No matching signature found');
    expect(() => {
      client.beta.webhooks.unwrap(payload, { headers: { ...headers, 'webhook-timestamp': '5' }, key });
    }).toThrow('Message timestamp too old');
    expect(() => {
      client
        .withOptions({ webhookKey: key })
        .beta.webhooks.unwrap(payload, { headers: { ...headers, 'webhook-timestamp': '5' } });
    }).toThrow('Message timestamp too old');
    expect(() => {
      client.beta.webhooks.unwrap(payload, { headers: { ...headers, 'webhook-id': 'wrong' }, key });
    }).toThrow('No matching signature found');
    expect(() => {
      client
        .withOptions({ webhookKey: key })
        .beta.webhooks.unwrap(payload, { headers: { ...headers, 'webhook-id': 'wrong' } });
    }).toThrow('No matching signature found');
    expect(() => {
      // @ts-expect-error headers is required by the type; omitting it at runtime must still throw, never skip verification
      client.beta.webhooks.unwrap(payload, { key });
    }).toThrow('Webhook headers are required in order to verify the signature');
    expect(() => {
      // @ts-expect-error same for a caller that passes no options at all, or the headers in their place
      client.beta.webhooks.unwrap(payload);
    }).toThrow('Webhook headers are required in order to verify the signature');
    expect(() => {
      // @ts-expect-error
      client.beta.webhooks.unwrap(payload, headers);
    }).toThrow('Webhook headers are required in order to verify the signature');
    expect(() => {
      // An empty key is an HMAC key anyone can sign with, so it must be rejected rather than used
      client.beta.webhooks.unwrap(payload, { headers, key: '' });
    }).toThrow('Webhook key must not be null or empty in order to unwrap');
  });
});
