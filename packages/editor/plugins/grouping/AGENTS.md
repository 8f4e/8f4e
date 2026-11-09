# Grouping Plugin

- Own visual `@group` behavior within the active project level. Nested language-level groups belong to
  core. Keep their child trees intact when copying.
- Select drag targets through `resolveCodeBlockDragTargets`. Core owns movement and snapping.
- Use the shared block serializer and injected clipboard writer. Apply group source changes as a batch.
