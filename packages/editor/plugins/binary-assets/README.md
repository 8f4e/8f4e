# Binary Assets Plugin

`@8f4e/editor-plugin-binary-assets` loads project-configured binary files into runtime memory. For lazy
installation, match raw `@config bin.*` directives with project scope, including configuration added during editing
and inside unopened groups. Detection uses cached parsed directives across the complete project tree. The plugin stays installed until
editor disposal. Custom hosts can install it through the standard plugin list:

```ts
import { createBinaryAssetsPlugin } from '@8f4e/editor-plugin-binary-assets';

const plugin = createBinaryAssetsPlugin({
	getMemoryBytes: () => memory ? new Uint8Array(memory.buffer) : undefined,
});
```

The memory getter reads the current buffer whenever bytes are copied, including after memory replacement or growth.
The plugin itself owns browser `fetch`, CacheStorage (`8f4e-binary-assets`), filename extraction, and its private
asset bytes and metadata. CacheStorage is optional; browsers without it fetch directly. Failures opening,
matching, or reading the cache fall back to the network. Failed cache writes still return the downloaded bytes;
network and response-body failures remain asset-loading errors.

Configure assets in project source:

```text
; @config bin.sound.url https://example.com/sample.pcm
; @config bin.sound.memory player:buffer
; @config bin.sound.memories.preview preview:buffer
```

Distinct URLs fetch concurrently. Each configured asset keeps one source record and its memory destinations,
including exposed project memory aliases. Configuration edits retain unchanged assets, their pending downloads,
and their loading indicators. Editing one URL replaces only that asset; editing memory destinations copies the
retained bytes into new targets without fetching again. Assets sharing a URL reuse the same downloaded source or
pending fetch, including assets added during editing. A completed source publishes its size constants and copies
into available targets immediately, independently of other downloads. Copies respect the target's allocated byte
length. The plugin reloads retained bytes when the compiler publishes a memory plan. Each downloading asset
contributes ID `asset:<id>` and message `Loading <id>...`.
Downloaded bytes mark it done; fetch errors mark it failed, even before runtime memory exists. Memory copying and
recompilation do not re-add indicators. Removing an asset or changing its URL cancels its pending indicator; disposal
cancels all pending indicators. New downloads replace the same ID. The loading-indicators plugin owns presentation
and private visibility. Binary loading does not open a dialog or block input.
Fetch failures are logged and excluded from the completed asset set.

Each pending URL has one shared cancellation handle. Downloads are aborted when no configured asset needs that
URL, and all pending downloads are aborted on disposal. Removing one asset keeps a shared download running for
the remaining assets. Cancellation does not log a download failure or mark a replacement download failed.

The plugin contributes `ASSET_<ID>_SIZE` constants and filename comments through the generic
`state.envConstantContributions` map. Core combines contributed source with runtime environment constants in `env`.
Asset sizes reflect the fetched file's complete length, even when the memory copy is truncated. Runtime payloads
stay private and are not serialized into project/session models; the source config is retained.

Installing the plugin registers its `bin` config schema. Omitting it leaves fetching, indicators, and asset constants
inactive. Disposal unsubscribes listeners, removes owned schema/constants, cancels pending indicators, releases retained bytes, and
ignores in-flight results from the disposed installation. Download results apply only to assets still configured with that URL.
