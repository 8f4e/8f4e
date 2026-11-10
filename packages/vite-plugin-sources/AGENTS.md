# Source Collection Guidelines

- Keep source discovery generic. Consumers own compiler, editor and gallery policies.
- Keep `virtual:8f4e-sources/<name>` a lazy text-loader map with slash-separated IDs relative to the source root
  and no final extension. Align exports, client types and README usage with this contract.
- Test with synthetic source trees and real Vite build/watch flows. Wait for native watcher registration before
  mutating files in watch tests.
