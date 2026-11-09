# Binary Assets Plugin

- Own `bin` configuration, asset downloads, cache access, memory population and generated size constants.
  Use live memory from the injected getter and recopy retained bytes after memory-plan changes.
- Share concurrent fetches by URL. Treat cache failure as recoverable and preserve downloaded bytes.
  Cancel unneeded fetches and ignore stale results after configuration changes or disposal.
- Track downloads as loading operations. Memory copies and recompilation leave download status alone.
