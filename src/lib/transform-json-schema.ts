import { pop } from '../internal/utils';

// Supported string formats
const SUPPORTED_STRING_FORMATS = new Set([
  'date-time',
  'time',
  'date',
  'duration',
  'email',
  'hostname',
  'uri',
  'ipv4',
  'ipv6',
  'uuid',
]);

export type JSONSchema = Record<string, any>;

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function transformJSONSchema(jsonSchema: JSONSchema): JSONSchema {
  const workingCopy = deepClone(jsonSchema);
  return _transformJSONSchema(workingCopy);
}

const LOCAL_DEF_REF = /^#\/\$defs\/([^/]+)$/;

/**
 * Resolves local `#/$defs/<name>` references inline and drops `$defs` once every
 * reference to it has been resolved. The API rejects `$defs` alongside `anyOf`
 * (`400 output_config.format.schema: For 'anyOf', '$defs' is not supported`), and
 * zod ≥ 4.6 emits exactly that shape for described unions when `toJSONSchema` is
 * called with `{ reused: 'ref' }`.
 *
 * References that cannot be inlined (recursive definitions, or refs to names that
 * don't exist in `$defs`) are left untouched, along with any `$defs` they need.
 */
export function inlineLocalDefs(jsonSchema: JSONSchema): JSONSchema {
  const defs = jsonSchema['$defs'];
  if (!defs || typeof defs !== 'object' || Array.isArray(defs)) {
    return jsonSchema;
  }
  const defNames = new Set(Object.keys(defs));

  const resolve = (node: unknown, expanding: string[]): unknown => {
    if (Array.isArray(node)) {
      return node.map((item) => resolve(item, expanding));
    }
    if (node !== null && typeof node === 'object') {
      const obj = node as Record<string, any>;
      const ref = obj['$ref'];
      if (typeof ref === 'string') {
        const match = LOCAL_DEF_REF.exec(ref);
        const defName = match?.[1];
        if (defName !== undefined && defNames.has(defName) && !expanding.includes(defName)) {
          return resolve(deepClone((defs as Record<string, any>)[defName]), [...expanding, defName]);
        }
      }
      const out: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        out[key] = key === '$defs' ? value : resolve(value, expanding);
      }
      return out;
    }
    return node;
  };

  const resolved = resolve(deepClone(jsonSchema), []) as Record<string, any>;
  if (!JSON.stringify(resolved).includes('#/$defs/')) {
    delete resolved['$defs'];
  }
  return resolved;
}

function _transformJSONSchema(jsonSchema: JSONSchema): JSONSchema {
  const strictSchema: JSONSchema = {};

  // `$defs` must be handled before the `$ref` early-return so that a root-level
  // `$ref` with sibling `$defs` keeps its (transformed) definitions.
  const defs = pop(jsonSchema, '$defs');
  if (defs !== undefined) {
    const strictDefs: Record<string, any> = {};
    strictSchema['$defs'] = strictDefs;
    for (const [name, defSchema] of Object.entries(defs)) {
      strictDefs[name] = _transformJSONSchema(defSchema as JSONSchema);
    }
  }

  const ref = pop(jsonSchema, '$ref');
  if (ref !== undefined) {
    strictSchema['$ref'] = ref;
    return strictSchema;
  }

  const type = pop(jsonSchema, 'type');
  const anyOf = pop(jsonSchema, 'anyOf');
  const oneOf = pop(jsonSchema, 'oneOf');
  const allOf = pop(jsonSchema, 'allOf');

  if (Array.isArray(anyOf)) {
    strictSchema['anyOf'] = anyOf.map((variant) => _transformJSONSchema(variant as JSONSchema));
  } else if (Array.isArray(oneOf)) {
    strictSchema['anyOf'] = oneOf.map((variant) => _transformJSONSchema(variant as JSONSchema));
  } else if (Array.isArray(allOf)) {
    strictSchema['allOf'] = allOf.map((entry) => _transformJSONSchema(entry as JSONSchema));
  } else {
    if (type === undefined) {
      throw new Error('JSON schema must have a type defined if anyOf/oneOf/allOf are not used');
    }
    strictSchema['type'] = type;
  }

  const description = pop(jsonSchema, 'description');
  if (description !== undefined) {
    strictSchema['description'] = description;
  }

  const title = pop(jsonSchema, 'title');
  if (title !== undefined) {
    strictSchema['title'] = title;
  }

  if (type === 'object') {
    const properties = pop(jsonSchema, 'properties') || {};

    strictSchema['properties'] = Object.fromEntries(
      Object.entries(properties).map(([key, propSchema]) => [
        key,
        _transformJSONSchema(propSchema as JSONSchema),
      ]),
    );

    pop(jsonSchema, 'additionalProperties');
    strictSchema['additionalProperties'] = false;

    const required = pop(jsonSchema, 'required');
    if (required !== undefined) {
      strictSchema['required'] = required;
    }
  } else if (type === 'string') {
    const format = pop(jsonSchema, 'format');
    if (format !== undefined && SUPPORTED_STRING_FORMATS.has(format)) {
      strictSchema['format'] = format;
    } else if (format !== undefined) {
      jsonSchema['format'] = format;
    }
  } else if (type === 'array') {
    const items = pop(jsonSchema, 'items');
    if (items !== undefined) {
      strictSchema['items'] = _transformJSONSchema(items as JSONSchema);
    }

    const minItems = pop(jsonSchema, 'minItems');
    if (minItems !== undefined && (minItems === 0 || minItems === 1)) {
      strictSchema['minItems'] = minItems;
    } else if (minItems !== undefined) {
      jsonSchema['minItems'] = minItems;
    }
  }

  if (Object.keys(jsonSchema).length > 0) {
    const existingDescription = strictSchema['description'];
    strictSchema['description'] =
      (existingDescription ? existingDescription + '\n\n' : '') +
      '{' +
      Object.entries(jsonSchema)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ') +
      '}';
  }

  return strictSchema;
}
