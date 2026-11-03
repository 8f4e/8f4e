# Reviewing Optional-Heavy Types

Use this check when a cleanup or type-tightening pass reveals interfaces with many optional fields, repeated optional chaining, non-null assertions, or boolean flags that describe mutually exclusive states.

This document is meant to help agents decide whether a broad type should stay broad, gain nested metadata, or split into smaller discriminated variants.

## Goal

Find types that use optional fields to represent different shapes, then decide whether those shapes should become explicit types.

## Why This Matters

Optional fields are useful for genuinely partial data, public configuration, and API results where a field may or may not exist. They become a problem when the compiler already knows a value is in one semantic state, but downstream code must keep rediscovering that state with optional chaining or fallback values.

Common costs:

- impossible states become representable;
- codegen compensates for weak analysis types;
- fields drift because producers and consumers disagree about which optional fields travel together;
- tests pass through broad fallback behavior instead of proving a precise contract;
- future refactors become large because many phases depend on the same loose shape.

## Warning Signs

Prioritize a type for review when several of these are true:

- it has many `?:` properties;
- optional fields only make sense in groups;
- a boolean flag controls whether other fields are present;
- consumers use `value.foo?.bar ?? fallback` for data that should be known by that phase;
- consumers use `!` after checking a separate flag;
- the same type is used for multiple lifecycle phases, such as discovery vs laid-out output;
- the type mixes source syntax, semantic facts, codegen state, and final output metadata;
- helpers accept `Partial<T>` or broad `Pick<T, ...>` because the full type has too many unrelated fields;
- tests need incomplete objects with casts such as `as unknown as T`;
- the type name is generic, such as `State`, `Context`, `Metadata`, `Item`, or `DataStructure`.

## Search Prompts

Start with a coarse optional-field sweep:

```sh
rg -n "interface |type .*=" packages/compiler/packages/language-spec/src packages/compiler/src -g '*.ts'
rg -n "\\?:" packages/compiler/packages/language-spec/src packages/compiler/src -g '*.ts'
```

Search for fallback behavior that may exist only because types are too loose:

```sh
rg -n "\\?\\.|\\?\\?|!|as unknown|as any|Partial<|Pick<|Record<string" packages/compiler/packages/language-spec/src packages/compiler/src -g '*.ts'
```

Search for flag-plus-optional-field patterns:

```sh
rg -n "is[A-Z]|has[A-Z]|kind|type|defaultSet|mode|phase|state" packages/compiler/packages/language-spec/src packages/compiler/src -g '*.ts'
```

Search for fields that tend to travel as a group:

```sh
rg -n "pointee|address|byteAddress|allocationUnitCount|isInteger|isFloat64" packages/compiler/packages/language-spec/src packages/compiler/src -g '*.ts'
```

For a quick ranked list, use a small script from the repo root:

```sh
node - <<'NODE'
const fs = require('fs');
const path = require('path');

const roots = ['packages/compiler/packages/language-spec/src', 'packages/compiler/src'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return fullPath.endsWith('.ts') && !fullPath.endsWith('.test.ts') ? [fullPath] : [];
  });
}

const results = [];
for (const file of roots.flatMap(walk)) {
  const text = fs.readFileSync(file, 'utf8');
  const re = /(export\s+)?(interface|type)\s+(\w+)[^{=]*(?:=\s*)?\{/g;
  let match;
  while ((match = re.exec(text))) {
    const open = text.indexOf('{', match.index);
    let depth = 0;
    let end = open;
    for (; end < text.length; end++) {
      if (text[end] === '{') depth++;
      if (text[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }

    const body = text.slice(open + 1, end);
    const props = body.split('\n').filter(line => /^\s*(readonly\s+)?[A-Za-z_$][\w$]*\??\s*:/.test(line));
    const optionals = props.filter(line => /^\s*(readonly\s+)?[A-Za-z_$][\w$]*\?\s*:/.test(line));
    if (optionals.length >= 2 || props.length >= 8) {
      results.push({
        file,
        name: match[3],
        props: props.length,
        optionals: optionals.length,
      });
    }
    re.lastIndex = end;
  }
}

for (const result of results.sort((a, b) => b.optionals - a.optionals || b.props - a.props)) {
  console.log(`${result.optionals}/${result.props} optional props\t${result.name}\t${result.file}`);
}
NODE
```

The ranked list is a starting point, not a verdict. Configuration and public result objects can legitimately have many optional fields.

## Review Steps

1. Name the variants hidden inside the type.

   Examples: scalar vs array, value vs address, discovered vs laid-out, unset default vs set default, module namespace vs constants namespace.

2. Identify producer and consumer phases.

   List where the type is created, mutated, narrowed, and read. If a later phase always expects one variant, the earlier phase should probably produce that variant explicitly.

3. Group fields by invariant.

   Fields that always travel together should usually become a nested object or a variant-specific interface.

4. Decide whether the split is local or shared.

   A local helper options object can often be changed immediately. A language-spec type crossing package boundaries may need a TODO and a staged plan.

5. Choose the smallest honest shape.

   Consider these options in order:

   - make an optional field required because all real producers already provide it;
   - move grouped optional fields into a nested object, such as `address` or `pointsTo`;
   - replace flag-plus-optionals with a discriminated union;
   - split lifecycle phases into separate types;
   - leave the type broad if it is truly a partial external API or user-provided options object.

6. Check whether this refactor depends on another broad type.

   Do not split a small state object if it immediately forces a larger unfinished migration. Record the dependency instead.

7. Remove fallback behavior as part of the split.

   The useful outcome is not just a new `kind` field. Consumers should stop using fallback values for states the type now proves.

8. Update tests directly.

   Avoid test-only casts or fixture shims that preserve old shapes. If snapshots change because the shape is stricter, update them intentionally.

## Split Or Leave

Split the type when:

- optional fields describe mutually exclusive states;
- one field is only valid when another field has a specific value;
- callers repeatedly narrow the same shape;
- code uses defaults for data that should be guaranteed;
- a later compiler phase has stronger knowledge than the type exposes;
- most consumers only use one coherent subset of the fields.

Leave the type broad when:

- it models user-provided options;
- it models public output where fields are omitted by feature flags;
- fields are independently optional rather than variant-specific;
- the cost of splitting is only cosmetic and does not remove real fallbacks or invalid states;
- the type is intentionally a sparse patch/update object.

## Validation

After a split, search for old optional fields and broad fallback patterns:

```sh
rg -n "oldFieldName|oldFlagName|\\?\\.|\\?\\?|!|as unknown|as any" packages/compiler/packages/language-spec/src packages/compiler/src -g '*.ts'
```

For language-spec changes, run the narrowest meaningful checks first, then broaden based on affected packages:

```sh
npx nx run @8f4e/language-spec:typecheck
npx nx run compiler:typecheck
npx nx run compiler:test
```

If editor or runtime packages consume the shared type, add their typecheck or test target as well.

## Review Notes

- A type with many optional fields is not automatically wrong. The smell is optional fields that encode hidden variants or lifecycle phases.
- The first attempt may reveal that the change is not small. Stop and record a TODO when the migration boundary is unclear.
- Do not keep compatibility aliases or old optional fields just to make the diff smaller. This project owns its callers and is not released yet.
- Prefer one precise migration over several partial discriminants that leave the same optional-field behavior behind.
