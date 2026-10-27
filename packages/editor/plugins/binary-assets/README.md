# Binary Assets Plugin

`@8f4e/editor-plugin-binary-assets` loads project-configured binary files into runtime memory. The default editor
includes it; custom hosts install it through the standard plugin list:

```ts
import { createBinaryAssetsPlugin } from '@8f4e/editor-plugin-binary-assets';

const plugin = createBinaryAssetsPlugin({
	getMemoryBytes: () => memory ? new Uint8Array(memory.buffer) : undefined,
});
```

The memory getter reads the current buffer whenever bytes are copied, including after memory replacement or growth.
The plugin itself owns browser `fetch`, CacheStorage (`8f4e-binary-assets`), filename extraction, and its private
asset bytes and metadata. CacheStorage is optional; browsers without it fetch directly.

Configure assets in project source:

```text
; @config bin.sound.url https://example.com/sample.pcm
; @config bin.sound.memory player:buffer
; @config bin.sound.memories.preview preview:buffer
```

Each URL is fetched once per configuration set and can load into several targets, including exposed project memory
aliases. Copies respect the target's allocated byte length. The plugin reloads retained bytes when the compiler
publishes a memory plan. It owns a loading dialog while fetching or waiting for configured targets to become ready.
Fetch failures are logged and excluded from the completed asset set.

The plugin contributes `ASSET_<ID>_SIZE` constants and filename comments through the generic
`state.envConstantContributions` map. Core combines contributed source with runtime environment constants in `env`.
Asset sizes reflect the fetched file's complete length, even when the memory copy is truncated. Runtime payloads
stay private and are not serialized into project/session models; the source config is retained.

Installing the plugin registers its `bin` config schema. Omitting it leaves fetching, dialogs, and asset constants
inactive. Disposal unsubscribes listeners, removes owned schema/constants/dialogs, releases retained bytes, and
ignores in-flight results from the disposed installation. Configuration changes similarly reject stale fetch results.
