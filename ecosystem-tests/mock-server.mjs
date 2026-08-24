#!/usr/bin/env node
// Zero-dependency mock of the Anthropic API for ecosystem tests.
// Responses mirror the real wire shapes closely enough for the SDK to parse them; a request the
// SDK built incorrectly gets a 4xx with a `mock: ...` message, so the test fails where it was sent.
import http from 'node:http';

const EXPECTED_API_KEY = process.env.MOCK_API_KEY ?? 'ecosystem-test-key';
const ROUTES = ['POST /v1/messages', 'GET /v1/models', 'POST /v1/files'];
const TEXT_CHUNKS = ['Hello', ' from mock'];
const MODELS = ['mock-model-3', 'mock-model-2', 'mock-model-1'].map((id, i) => ({
  type: 'model',
  id,
  display_name: `Mock Model ${3 - i}`,
  created_at: '2025-01-01T00:00:00Z',
  capabilities: null,
  max_input_tokens: null,
  max_tokens: null,
}));

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
};

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    ...CORS,
    'request-id': 'req_mock_0123456789',
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...headers,
  });
  res.end(payload);
}

function sendError(res, status, type, message) {
  send(res, status, { type: 'error', error: { type, message }, request_id: 'req_mock_0123456789' });
}

function reject(res, status, problem) {
  const type = { 401: 'authentication_error', 404: 'not_found_error' }[status] ?? 'invalid_request_error';
  sendError(res, status, type, `mock: ${problem}`);
}

function usage(output_tokens) {
  return {
    input_tokens: 10,
    output_tokens,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    cache_creation: null,
    inference_geo: null,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: 'standard',
  };
}

function message(model, content, stop_reason, output_tokens) {
  return {
    id: 'msg_mock_0123456789',
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason,
    stop_sequence: null,
    stop_details: null,
    container: null,
    usage: usage(output_tokens),
  };
}

/** Returns [status, problem] for the first header the SDK got wrong. */
function headerProblem(req, url) {
  const h = req.headers;
  if (h['x-api-key'] !== EXPECTED_API_KEY && h['authorization'] !== `Bearer ${EXPECTED_API_KEY}`) {
    return [401, `expected x-api-key: ${EXPECTED_API_KEY}, got ${JSON.stringify(h['x-api-key'])}`];
  }
  if (!h['anthropic-version']) return [400, 'missing anthropic-version header'];
  if (!h['user-agent']) return [400, 'missing user-agent header'];
  if (h['x-stainless-lang'] !== 'js') {
    return [400, `expected x-stainless-lang: js, got ${JSON.stringify(h['x-stainless-lang'])}`];
  }
  if (url.pathname === '/v1/files' && url.searchParams.get('beta') === 'true' && !h['anthropic-beta']) {
    return [400, 'missing anthropic-beta header on beta endpoint'];
  }
  if (req.method === 'POST') {
    const ct = h['content-type'] ?? '';
    const want = url.pathname === '/v1/files' ? 'multipart/form-data' : 'application/json';
    if (!ct.startsWith(want)) return [400, `expected content-type ${want}, got ${JSON.stringify(ct)}`];
  }
  return null;
}

function messagesProblems(body) {
  const problems = [];
  if (typeof body !== 'object' || body === null) return ['body is not a JSON object'];
  if (typeof body.model !== 'string' || !body.model) problems.push('`model` must be a non-empty string');
  if (typeof body.max_tokens !== 'number') problems.push('`max_tokens` must be a number');
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    problems.push('`messages` must be a non-empty array');
  } else {
    body.messages.forEach((m, i) => {
      if (!m || !['user', 'assistant'].includes(m.role)) problems.push(`messages[${i}].role is invalid`);
      if (!m || !(typeof m.content === 'string' || Array.isArray(m.content))) {
        problems.push(`messages[${i}].content must be a string or array`);
      }
    });
  }
  return problems;
}

// Just enough multipart/form-data parsing to check the SDK built the upload correctly.
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!m) return { error: 'no multipart boundary in content-type' };
  const boundary = Buffer.from(`--${m[1] ?? m[2]}`);
  const parts = [];
  let pos = buf.indexOf(boundary);
  if (pos === -1) return { error: 'boundary not found in body' };
  for (;;) {
    pos += boundary.length;
    if (buf.slice(pos, pos + 2).toString() === '--') break;
    pos += 2; // CRLF
    const headerEnd = buf.indexOf('\r\n\r\n', pos);
    if (headerEnd === -1) return { error: 'malformed part headers' };
    const rawHeaders = buf.slice(pos, headerEnd).toString('utf8');
    const next = buf.indexOf(boundary, headerEnd + 4);
    if (next === -1) return { error: 'unterminated part' };
    const body = buf.slice(headerEnd + 4, next - 2); // strip CRLF before boundary
    const headers = {};
    for (const line of rawHeaders.split('\r\n')) {
      const i = line.indexOf(':');
      if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
    const disp = headers['content-disposition'] ?? '';
    parts.push({
      name: /\bname="([^"]*)"/.exec(disp)?.[1],
      filename: /\bfilename="([^"]*)"/.exec(disp)?.[1],
      contentType: headers['content-type'],
      body,
    });
    pos = next;
  }
  return { parts };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function streamMessage(res, model) {
  res.writeHead(200, { ...CORS, 'content-type': 'text/event-stream', 'request-id': 'req_mock_0123456789' });
  const write = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
  write('message_start', { message: message(model, [], null, 1) });
  write('content_block_start', { index: 0, content_block: { type: 'text', text: '', citations: null } });
  for (const text of TEXT_CHUNKS) {
    await new Promise((r) => setTimeout(r, 5));
    write('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
  }
  write('content_block_stop', { index: 0 });
  write('message_delta', {
    delta: { stop_reason: 'end_turn', stop_sequence: null, stop_details: null, container: null },
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      output_tokens_details: null,
      server_tool_use: null,
    },
  });
  write('message_stop', {});
  res.end();
}

/** Resolves to true if the client went away while waiting. */
function wait(ms, res) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    res.once('close', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function handle(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = `${req.method} ${url.pathname}`;

  if (req.method === 'OPTIONS') return send(res, 204);
  if (route === 'GET /_mock/health') return send(res, 200, { ok: true });

  const raw = await readBody(req);
  if (!ROUTES.includes(route)) return reject(res, 404, `no route for ${route}`);
  const problem = headerProblem(req, url);
  if (problem) return reject(res, ...problem);
  let body;
  if ((req.headers['content-type'] ?? '').startsWith('application/json')) {
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      return reject(res, 400, 'body is not valid JSON');
    }
  }

  switch (route) {
    case 'POST /v1/messages': {
      const problems = messagesProblems(body);
      if (problems.length) return reject(res, 400, problems.join('; '));
      if (body.model === 'mock-error') {
        return sendError(res, 400, 'invalid_request_error', 'mock-error: this model always fails');
      }
      // lets projects test timeouts and aborts
      if (body.model === 'mock-slow' && (await wait(5000, res))) return;
      if (body.stream === true) return streamMessage(res, body.model);
      const text = { type: 'text', text: TEXT_CHUNKS.join(''), citations: null };
      return send(res, 200, message(body.model, [text], 'end_turn', 5));
    }
    case 'GET /v1/models': {
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const after = url.searchParams.get('after_id');
      const start = after ? MODELS.findIndex((m) => m.id === after) + 1 : 0;
      const data = MODELS.slice(start, start + limit);
      return send(res, 200, {
        data,
        has_more: start + limit < MODELS.length,
        first_id: data[0]?.id ?? null,
        last_id: data[data.length - 1]?.id ?? null,
      });
    }
    case 'POST /v1/files': {
      const parsed = parseMultipart(raw, req.headers['content-type'] ?? '');
      const file = parsed.parts?.find((p) => p.name === 'file');
      const problem =
        parsed.error ??
        (!file ? 'missing `file` part'
        : !file.filename ? '`file` part has no filename'
        : !file.contentType ? '`file` part has no content-type'
        : file.body.length === 0 ? '`file` part is empty'
        : null);
      if (problem) return reject(res, 400, problem);
      return send(res, 200, {
        type: 'file',
        id: 'file_mock_0123456789',
        filename: file.filename,
        mime_type: file.contentType,
        size_bytes: file.body.length,
        created_at: '2025-01-01T00:00:00Z',
        downloadable: false,
      });
    }
  }
}

const portArg = process.argv.indexOf('--port');
const port = Number(portArg !== -1 ? process.argv[portArg + 1] : process.env.PORT ?? 0);
const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    if (!res.headersSent) sendError(res, 500, 'api_error', `mock: server error: ${err?.message}`);
    else res.end();
  });
});
server.listen(port, '127.0.0.1', () => {
  // The runner reads this line to learn the port.
  console.log(JSON.stringify({ port: server.address().port }));
});
