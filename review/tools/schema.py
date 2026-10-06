# ═══════════════════════════════════════════════════════════════════════════════
# secrets.sgit.ai — Schema__Validator
# A small JSON Schema validator, standard library only, covering the subset the
# review schemas use: type, required, properties, additionalProperties, items,
# enum, const, minItems, pattern, anyOf, $ref to a definition in the same file.
# Returns a list of problems as "path: message"; an empty list is valid.
# ═══════════════════════════════════════════════════════════════════════════════

import re


TYPES = {'object' : dict, 'array' : list, 'string' : str, 'integer' : int, 'number' : (int, float), 'boolean' : bool, 'null' : type(None)}


class Schema__Validator:

    def __init__(self, schema):
        self.schema      = schema
        self.definitions = schema.get('$defs', {})

    def validate(self, data):
        problems = []
        self.check(data, self.schema, '$', problems)
        return problems

    def resolve(self, schema):
        if '$ref' in schema:
            name = schema['$ref'].split('/')[-1]
            return self.definitions[name]
        return schema

    def type_ok(self, value, expected):
        if expected == 'integer':
            return isinstance(value, int) and not isinstance(value, bool)
        if expected == 'number':
            return isinstance(value, (int, float)) and not isinstance(value, bool)
        return isinstance(value, TYPES[expected])

    def check(self, value, schema, where, problems):
        schema = self.resolve(schema)
        if 'anyOf' in schema:
            attempts = []
            for option in schema['anyOf']:
                sub = []
                self.check(value, option, where, sub)
                if not sub:
                    return
                attempts.append(sub)
            problems.append(f'{where}: matches none of the allowed shapes ({"; ".join(attempt[0] for attempt in attempts)})')
            return
        expected = schema.get('type')
        if expected:
            allowed = expected if isinstance(expected, list) else [expected]
            if not any(self.type_ok(value, t) for t in allowed):
                problems.append(f'{where}: expected {"/".join(allowed)}, got {type(value).__name__}')
                return
        if 'const' in schema and value != schema['const']:
            problems.append(f'{where}: must be {schema["const"]!r}')
        if 'enum' in schema and value not in schema['enum']:
            problems.append(f'{where}: {value!r} is not one of {schema["enum"]}')
        if isinstance(value, str) and 'pattern' in schema and not re.search(schema['pattern'], value):
            problems.append(f'{where}: {value!r} does not match /{schema["pattern"]}/')
        if isinstance(value, dict):
            for key in schema.get('required', []):
                if key not in value:
                    problems.append(f'{where}: missing required "{key}"')
            properties = schema.get('properties', {})
            for key, item in value.items():
                if key in properties:
                    self.check(item, properties[key], f'{where}.{key}', problems)
                elif schema.get('additionalProperties') is False:
                    problems.append(f'{where}: unexpected key "{key}"')
                elif isinstance(schema.get('additionalProperties'), dict):
                    self.check(item, schema['additionalProperties'], f'{where}.{key}', problems)
        if isinstance(value, list):
            if 'minItems' in schema and len(value) < schema['minItems']:
                problems.append(f'{where}: needs at least {schema["minItems"]} item(s)')
            if 'items' in schema:
                for index, item in enumerate(value):
                    self.check(item, schema['items'], f'{where}[{index}]', problems)
