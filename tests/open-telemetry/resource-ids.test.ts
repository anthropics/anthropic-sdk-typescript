import { SpanStatusCode } from '@opentelemetry/api';
import type Anthropic from '@anthropic-ai/sdk';
import {
  RESOURCE_IDS,
  createdID,
  json,
  makeClient,
  onlySpan,
  pathID,
  resourceIDsOf,
  setUpTracing,
  spans,
  sse,
  SESSION_EVENT,
  type ResourceIDCase,
} from './utils';

setUpTracing();

// Every attribute name comes from `resource-ids.json`, which is written with the call sites.
const SESSION_ID = pathID('beta.sessions.retrieve', 'session_id');
const THREAD_ID = pathID('beta.sessions.threads.retrieve', 'thread_id');
const AGENT_ID = pathID('beta.agents.retrieve', 'agent_id');
const BATCH_ID = pathID('messages.batches.retrieve', 'message_batch_id');
// `beta.sessions.create` has these two from the request's body, which the file does not list.
const SESSION_AGENT_AND_ENVIRONMENT = { [AGENT_ID]: 'agent_1', 'anthropic.session.environment.id': 'env_1' };

/** The resource ID attributes of the one span with `name`. */
const resourceIDs = (name: string) => resourceIDsOf(onlySpan(name));

/** A page of a cursor list whose items have IDs of their own. */
const page = (ids: string[], nextPage: string | null = null) =>
  json({ data: ids.map((id) => ({ id })), next_page: nextPage });

describe('OpenTelemetry spans', () => {
  describe('resource IDs of one method per resource', () => {
    /** Calls the SDK method that `call` names, such as `beta.sessions.threads.retrieve`. */
    const invoke = (client: Anthropic, { call, arguments: args }: ResourceIDCase): any => {
      const names = call.split('.');
      const method = names.pop()!;
      const resource = names.reduce((target: any, name) => target[name], client);
      expect(typeof resource?.[method]).toBe('function');
      return resource[method](...args);
    };
    const cases = (kind: ResourceIDCase['kind']) =>
      RESOURCE_IDS.cases.filter((each) => each.kind === kind).map((each) => [each.method, each] as const);
    const failure = json({ type: 'error', error: { type: 'invalid_request_error', message: 'no' } }, 400);

    test('the file has a case of each kind', () => {
      for (const kind of ['path', 'created', 'created_field', 'list'] as const) {
        expect(cases(kind).length).toBeGreaterThan(0);
      }
    });

    test.each(RESOURCE_IDS.cases.map((each) => [each.method, each] as const))(
      '%s has the method and the route of its endpoint, and the path it requested',
      async (_, each) => {
        const { verb, route, path } = RESOURCE_IDS.operations[each.method]!;
        const { client } = makeClient([json({ id: 'response_1', type: 'object', data: [] })]);

        await invoke(client, each);

        expect(onlySpan(each.span).attributes).toMatchObject({
          'http.request.method': verb,
          'http.route': route,
          'url.path': route.replace(/\{(\w+)\}/g, (_, name) => String(each.expect[path[name]!])),
        });
      },
    );

    test.each(cases('path'))(
      '%s has the IDs in its path, and not the ID in its response',
      async (_, each) => {
        const { client } = makeClient([json({ id: 'response_1', type: 'object' })]);

        await invoke(client, each);

        expect(Object.keys(each.expect).length).toBeGreaterThan(0);
        expect(resourceIDsOf(onlySpan(each.span))).toEqual(each.expect);
        // Only a Session thread in the path gives the span a conversation ID.
        expect(onlySpan(each.span).attributes['gen_ai.conversation.id']).toBe(each.expect[THREAD_ID]);
      },
    );

    test.each([...cases('created'), ...cases('created_field')])(
      '%s has the ID of the object it creates, unless it fails',
      async (_, each) => {
        const { attribute, field } = each.created!;
        const { client } = makeClient([json({ type: 'object', [field]: 'created_1' }), failure]);

        await invoke(client, each);
        await expect(invoke(client, each)).rejects.toThrow();

        const [created, failed] = spans(each.span);
        expect(resourceIDsOf(created!)).toEqual({ ...each.expect, [attribute]: 'created_1' });
        expect(failed!.status.code).toBe(SpanStatusCode.ERROR);
        expect(resourceIDsOf(failed!)).toEqual(each.expect);
      },
    );

    test.each(cases('created_field'))('%s takes the ID from the field that has it', async (_, each) => {
      const { attribute, field } = each.created!;
      expect(field).not.toBe('id');
      const { client } = makeClient([json({ type: 'object', id: 'other_1' })]);

      await invoke(client, each);

      expect(resourceIDsOf(onlySpan(each.span))).not.toHaveProperty(attribute);
    });

    test.each(cases('list'))('%s has the IDs in its path on every page', async (_, each) => {
      // A first and a last page, in the fields of every kind of page.
      const page = (id: string, more: boolean) =>
        json({
          data: [{ id }],
          has_more: more,
          first_id: id,
          last_id: id,
          next_page: more ? 'page_2' : null,
        });
      const { client, requests } = makeClient([page('item_1', true), page('item_2', false)]);

      const items = [];
      for await (const item of invoke(client, each)) {
        items.push(item.id);
      }

      expect(items).toEqual(['item_1', 'item_2']);
      expect(requests).toHaveLength(2);
      expect(spans(each.span).map(resourceIDsOf)).toEqual([each.expect, each.expect]);
    });
  });

  describe('resource IDs', () => {
    test('a method has the IDs in its path, from its arguments', async () => {
      const session = { id: 'sesn_response', type: 'session' };
      const { client } = makeClient([json(session), json(session), json(session), json(session)]);

      await client.beta.sessions.retrieve('sesn_1');
      await client.beta.sessions.update('sesn_1', { title: 'renamed' });
      await client.beta.sessions.archive('sesn_1');
      await client.beta.sessions.delete('sesn_1');

      for (const method of ['retrieve', 'update', 'archive', 'delete']) {
        expect(resourceIDs(`anthropic.sessions.${method}`)).toEqual({ [SESSION_ID]: 'sesn_1' });
      }
    });

    test('a method of a nested resource has one ID for each level of its path', async () => {
      const thread = { id: 'sthr_response', type: 'session_thread' };
      const { client } = makeClient([json(thread), json(thread), page(['sevt_1']), sse([SESSION_EVENT])]);
      const both = { [SESSION_ID]: 'sesn_1', [THREAD_ID]: 'sthr_1' };

      await client.beta.sessions.threads.retrieve('sthr_1', { session_id: 'sesn_1' });
      await client.beta.sessions.threads.archive('sthr_1', { session_id: 'sesn_1' });
      await client.beta.sessions.threads.events.list('sthr_1', { session_id: 'sesn_1' });
      for await (const _ of await client.beta.sessions.threads.events.stream('sthr_1', {
        session_id: 'sesn_1',
      })) {
      }

      expect(resourceIDs('anthropic.sessions.threads.retrieve')).toEqual(both);
      expect(resourceIDs('anthropic.sessions.threads.archive')).toEqual(both);
      expect(resourceIDs('anthropic.sessions.threads.events.list')).toEqual(both);
      expect(resourceIDs('anthropic.sessions.threads.events.stream')).toEqual(both);
    });

    describe('the conversation ID', () => {
      const thread = { id: 'sthr_response', type: 'session_thread' };
      const conversations = (name: string) =>
        spans(name).map((span) => span.attributes['gen_ai.conversation.id']);

      test('a method of a Session thread has the ID of the thread in its path', async () => {
        const { client } = makeClient([
          json(thread),
          json(thread),
          page(['sevt_1'], 'page_2'),
          page(['sevt_2']),
          sse([SESSION_EVENT]),
        ]);
        const session = { session_id: 'sesn_1' };

        await client.beta.sessions.threads.retrieve('sthr_1', session);
        await client.beta.sessions.threads.archive('sthr_1', session);
        for await (const _ of client.beta.sessions.threads.events.list('sthr_1', session)) {
        }
        for await (const _ of await client.beta.sessions.threads.events.stream('sthr_1', session)) {
        }

        // Every method with the thread's ID in its path, and no other, is listed here.
        const methods = Object.values(RESOURCE_IDS.operations).filter((each) => 'thread_id' in each.path);
        expect(methods.map((each) => each.span).sort()).toEqual([
          'anthropic.sessions.threads.archive',
          'anthropic.sessions.threads.events.list',
          'anthropic.sessions.threads.events.stream',
          'anthropic.sessions.threads.retrieve',
        ]);
        expect(conversations('anthropic.sessions.threads.retrieve')).toEqual(['sthr_1']);
        expect(conversations('anthropic.sessions.threads.archive')).toEqual(['sthr_1']);
        expect(conversations('anthropic.sessions.threads.events.list')).toEqual(['sthr_1', 'sthr_1']);
        expect(conversations('anthropic.sessions.threads.events.stream')).toEqual(['sthr_1']);
        expect(onlySpan('anthropic.sessions.threads.retrieve').attributes[THREAD_ID]).toBe('sthr_1');
      });

      test('the one that the application gives replaces the ID of the thread', async () => {
        const { client } = makeClient([json(thread), page(['sevt_1'], 'page_2'), page(['sevt_2'])]);
        const session = { session_id: 'sesn_1' };
        const conversation = { openTelemetry: { conversationId: 'conv-1' } };

        await client.beta.sessions.threads.retrieve('sthr_1', session, conversation);
        for await (const _ of client.beta.sessions.threads.events.list('sthr_1', session, conversation)) {
        }

        expect(conversations('anthropic.sessions.threads.retrieve')).toEqual(['conv-1']);
        expect(conversations('anthropic.sessions.threads.events.list')).toEqual(['conv-1', 'conv-1']);
        expect(onlySpan('anthropic.sessions.threads.retrieve').attributes[THREAD_ID]).toBe('sthr_1');
      });

      test('a method without a thread in its path has none', async () => {
        const { client } = makeClient([
          json({ id: 'sesn_1', type: 'session' }),
          page(['sthr_1']),
          page(['sevt_1']),
        ]);

        await client.beta.sessions.retrieve('sesn_1');
        await client.beta.sessions.threads.list('sesn_1');
        await client.beta.sessions.events.list('sesn_1');

        for (const name of ['retrieve', 'threads.list', 'events.list']) {
          expect(onlySpan(`anthropic.sessions.${name}`).attributes).not.toHaveProperty(
            'gen_ai.conversation.id',
          );
        }
      });
    });

    test('a method that creates one object has the ID of that object, from the response', async () => {
      const { client } = makeClient([
        json({ id: 'sesn_new', type: 'session' }),
        json({ id: 'agent_new', type: 'agent' }),
        json({ id: 'msgbatch_new', type: 'message_batch' }),
        json({ id: 'msgbatch_beta', type: 'message_batch' }),
      ]);

      await client.beta.sessions.create({ agent: 'agent_1', environment_id: 'env_1' });
      await client.beta.agents.create({ model: 'model-a', name: 'helper' });
      await client.messages.batches.create({ requests: [] });
      await client.beta.messages.batches.create({ requests: [] });

      expect(resourceIDs('anthropic.sessions.create')).toEqual({
        ...SESSION_AGENT_AND_ENVIRONMENT,
        [createdID('beta.sessions.create')]: 'sesn_new',
      });
      expect(resourceIDs('anthropic.agents.create')).toEqual({
        [createdID('beta.agents.create')]: 'agent_new',
      });
      expect(createdID('messages.batches.create')).toBe(createdID('beta.messages.batches.create'));
      const created = createdID('messages.batches.create');
      expect(spans('anthropic.messages.batches.create').map((span) => span.attributes[created])).toEqual([
        'msgbatch_new',
        'msgbatch_beta',
      ]);
    });

    test('a response read with withResponse keeps the ID of the created object', async () => {
      const { client } = makeClient([json({ id: 'sesn_new', type: 'session' })]);

      await client.beta.sessions.create({ agent: 'agent_1', environment_id: 'env_1' }).withResponse();

      expect(resourceIDs('anthropic.sessions.create')).toEqual({
        ...SESSION_AGENT_AND_ENVIRONMENT,
        [SESSION_ID]: 'sesn_new',
      });
    });

    test('a create that fails does not have the ID of the object', async () => {
      const { client } = makeClient([
        json({ type: 'error', error: { type: 'invalid_request_error', message: 'no' } }, 400),
        json({ type: 'error', error: { type: 'invalid_request_error', message: 'no' } }, 400),
      ]);

      await expect(
        client.beta.sessions.create({ agent: 'agent_1', environment_id: 'env_1' }),
      ).rejects.toThrow();
      await expect(client.messages.batches.create({ requests: [] })).rejects.toThrow();

      expect(onlySpan('anthropic.sessions.create').status.code).toBe(SpanStatusCode.ERROR);
      expect(resourceIDs('anthropic.sessions.create')).toEqual(SESSION_AGENT_AND_ENVIRONMENT);
      expect(resourceIDs('anthropic.messages.batches.create')).toEqual({});
    });

    test.each([undefined, false as const])(
      'a create of a Session whose agent is no agent leaves it to the API to refuse, with openTelemetry: %s',
      async (openTelemetry) => {
        const { client, requests } = makeClient(
          [json({ type: 'error', error: { type: 'invalid_request_error', message: 'no' } }, 400)],
          { openTelemetry },
        );

        await expect(
          client.beta.sessions.create({ agent: null as never, environment_id: 'env_1' }),
        ).rejects.toThrow('no');

        expect(requests[0]!.body.agent).toBeNull();
        if (openTelemetry !== false) {
          expect(resourceIDs('anthropic.sessions.create')).toEqual({
            'anthropic.session.environment.id': 'env_1',
          });
        }
      },
    );

    test('a create whose response has no string ID has none', async () => {
      const { client } = makeClient([json({ type: 'session' }), json({ id: 7, type: 'agent' })]);

      await client.beta.sessions.create({ agent: 'agent_1', environment_id: 'env_1' });
      await client.beta.agents.create({ model: 'model-a', name: 'helper' });

      expect(onlySpan('anthropic.sessions.create').status.code).toBe(SpanStatusCode.OK);
      expect(resourceIDs('anthropic.sessions.create')).toEqual(SESSION_AGENT_AND_ENVIRONMENT);
      expect(resourceIDs('anthropic.agents.create')).toEqual({});
    });

    test('a create of a Session has its Agent, its model and its environment', async () => {
      const session = {
        id: 'sesn_new',
        type: 'session',
        environment_id: 'env_1',
        agent: { id: 'agent_1', type: 'agent', version: 2, name: 'helper', model: { id: 'model-resolved' } },
      };
      const { client } = makeClient([json(session), json(session), json(session)]);

      await client.beta.sessions.create({ agent: 'agent_1', environment_id: 'env_1' });
      await client.beta.sessions.create({
        agent: { type: 'agent_with_overrides', id: 'agent_1', version: 2, model: 'model-override' },
        environment_id: 'env_1',
      });
      await client.beta.sessions.retrieve('sesn_new');

      // The model is the one the Session resolved, which the request's override does not decide.
      const created = {
        ...SESSION_AGENT_AND_ENVIRONMENT,
        [SESSION_ID]: 'sesn_new',
        'gen_ai.agent.name': 'helper',
        'gen_ai.request.model': 'model-resolved',
      };
      const [fromID, fromObject] = spans('anthropic.sessions.create');
      expect(fromID!.attributes).toMatchObject(created);
      expect(fromObject!.attributes).toMatchObject(created);
      const retrieved = Object.keys(onlySpan('anthropic.sessions.retrieve').attributes);
      expect(retrieved).toContain(SESSION_ID);
      for (const name of Object.keys(created).filter((name) => name !== SESSION_ID)) {
        expect(retrieved).not.toContain(name);
      }
    });

    test('a create of a Session that fails keeps its Agent and its environment', async () => {
      const { client } = makeClient([
        json({ type: 'error', error: { type: 'invalid_request_error', message: 'no' } }, 400),
      ]);

      await expect(
        client.beta.sessions.create({ agent: { type: 'agent', id: 'agent_1' }, environment_id: 'env_1' }),
      ).rejects.toThrow();

      const { attributes, status } = onlySpan('anthropic.sessions.create');
      expect(status.code).toBe(SpanStatusCode.ERROR);
      expect(attributes).toMatchObject(SESSION_AGENT_AND_ENVIRONMENT);
      expect(Object.keys(attributes)).not.toContain('gen_ai.agent.name');
      expect(Object.keys(attributes)).not.toContain('gen_ai.request.model');
    });

    test('a list has only the IDs in its path, on every page', async () => {
      const { client } = makeClient([
        page(['sesn_a']),
        page(['agent_a']),
        json({ data: [{ id: 'msgbatch_a' }], has_more: false }),
        page(['sthr_a']),
        page(['agent_a']),
        page(['sevt_a'], 'page_2'),
        page(['sevt_b']),
      ]);

      await client.beta.sessions.list();
      await client.beta.agents.list();
      await client.messages.batches.list();
      await client.beta.sessions.threads.list('sesn_1');
      await client.beta.agents.versions.list('agent_1');
      const events = [];
      for await (const event of client.beta.sessions.events.list('sesn_1')) {
        events.push(event.id);
      }

      expect(resourceIDs('anthropic.sessions.list')).toEqual({});
      expect(resourceIDs('anthropic.agents.list')).toEqual({});
      expect(resourceIDs('anthropic.messages.batches.list')).toEqual({});
      expect(resourceIDs('anthropic.sessions.threads.list')).toEqual({ [SESSION_ID]: 'sesn_1' });
      expect(resourceIDs('anthropic.agents.versions.list')).toEqual({ [AGENT_ID]: 'agent_1' });
      expect(events).toEqual(['sevt_a', 'sevt_b']);
      expect(spans('anthropic.sessions.events.list').map((span) => span.attributes[SESSION_ID])).toEqual([
        'sesn_1',
        'sesn_1',
      ]);
    });

    test('an ID in the path is recorded as it is, also when it is not an ID', async () => {
      const { client } = makeClient([
        json({ id: 'skillver_1', type: 'skill_version' }),
        json({ id: 'sthr_response', type: 'session_thread' }),
      ]);

      await client.beta.skills.versions.retrieve('latest', { skill_id: 'skill_1' });
      await client.beta.sessions.threads.retrieve('a thread/1', { session_id: 'not an id' });

      expect(resourceIDs('anthropic.skills.versions.retrieve')).toEqual({
        [pathID('beta.skills.versions.retrieve', 'skill_id')]: 'skill_1',
        [pathID('beta.skills.versions.retrieve', 'version')]: 'latest',
      });
      expect(onlySpan('anthropic.sessions.threads.retrieve').attributes).toMatchObject({
        [SESSION_ID]: 'not an id',
        [THREAD_ID]: 'a thread/1',
        'gen_ai.conversation.id': 'a thread/1',
      });
    });

    test('a method that creates several objects has only the IDs in its path', async () => {
      const { client } = makeClient([json({ data: [{ id: 'sevt_1', type: 'user.message' }] })]);

      await client.beta.sessions.events.send('sesn_1', {
        events: [{ type: 'user.message', content: [{ type: 'text', text: 'hi' }] }],
      });

      expect(resourceIDs('anthropic.sessions.events.send')).toEqual({ [SESSION_ID]: 'sesn_1' });
    });

    test('a stream has the IDs in its path', async () => {
      const { client } = makeClient([sse([SESSION_EVENT])]);

      for await (const _ of await client.beta.sessions.events.stream('sesn_1')) {
      }

      expect(resourceIDs('anthropic.sessions.events.stream')).toEqual({ [SESSION_ID]: 'sesn_1' });
    });

    test('an Agent is identified by gen_ai.agent.id', async () => {
      const agent = { id: 'agent_response', type: 'agent' };
      const { client } = makeClient([json(agent), json(agent), json(agent)]);

      await client.beta.agents.retrieve('agent_1');
      await client.beta.agents.update('agent_1', { version: 1 });
      await client.beta.agents.archive('agent_1');

      for (const method of ['retrieve', 'update', 'archive']) {
        expect(resourceIDs(`anthropic.agents.${method}`)).toEqual({ [AGENT_ID]: 'agent_1' });
      }
    });

    test('a Message Batch method has the ID of the batch it acts on, also when it fails', async () => {
      const batch = { id: 'msgbatch_response', type: 'message_batch', results_url: null };
      const { client } = makeClient([
        json(batch),
        json(batch),
        json({ id: 'msgbatch_response', type: 'message_batch_deleted' }),
        json({ type: 'error', error: { type: 'not_found_error', message: 'no' } }, 404),
      ]);

      await client.messages.batches.retrieve('msgbatch_1');
      await client.beta.messages.batches.cancel('msgbatch_1');
      await client.messages.batches.delete('msgbatch_1');
      await expect(client.beta.messages.batches.retrieve('msgbatch_2')).rejects.toThrow();

      expect(spans('anthropic.messages.batches.retrieve').map((span) => span.attributes[BATCH_ID])).toEqual([
        'msgbatch_1',
        'msgbatch_2',
      ]);
      expect(resourceIDs('anthropic.messages.batches.cancel')).toEqual({ [BATCH_ID]: 'msgbatch_1' });
      expect(resourceIDs('anthropic.messages.batches.delete')).toEqual({ [BATCH_ID]: 'msgbatch_1' });
    });

    test('a method with no ID in its path that creates nothing has none', async () => {
      const { client } = makeClient([json({ data: [{ id: 'model-a', type: 'model' }], has_more: false })]);

      await client.models.list();

      const attributes = Object.keys(onlySpan('anthropic.models.list').attributes);
      expect(attributes.filter((name) => name.endsWith('.id'))).toEqual(['anthropic.request.id']);
    });
  });
});
