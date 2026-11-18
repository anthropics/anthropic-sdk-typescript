import { z } from 'zod/v4';
import { betaZodOutputFormat } from '../../src/helpers/beta/zod';
import { zodOutputFormat } from '../../src/helpers/zod';
import { inlineLocalDefs } from '../../src/lib/transform-json-schema';

describe('issue #1270: zodOutputFormat must not emit $defs alongside anyOf', () => {
  const union = () => z.union([z.object({ a: z.string() }), z.object({ b: z.string() })]).describe('U');

  it('zodOutputFormat inlines union branches, no $defs', () => {
    const out = zodOutputFormat(union()).schema as any;
    expect(out.$defs).toBeUndefined();
    expect(out.anyOf).toHaveLength(2);
    expect(out.anyOf[0].properties.a).toBeDefined();
    expect(out.anyOf[1].properties.b).toBeDefined();
  });

  it('betaZodOutputFormat inlines union branches, no $defs', () => {
    const out = betaZodOutputFormat(union()).schema as any;
    expect(out.$defs).toBeUndefined();
    expect(out.anyOf).toHaveLength(2);
  });

  it('inlineLocalDefs leaves recursive schemas safe (no infinite loop, $defs kept)', () => {
    const Category: any = z.object({
      name: z.string(),
      get subcats(): any {
        return z.array(Category);
      },
    });
    const raw = z.toJSONSchema(Category, { reused: 'ref' }) as any;
    const out = inlineLocalDefs(raw);
    expect(JSON.stringify(out).length).toBeLessThan(100000);
  });

  it('inlineLocalDefs is a no-op when there are no $defs', () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } } };
    expect(inlineLocalDefs(schema)).toEqual(schema);
  });
});
