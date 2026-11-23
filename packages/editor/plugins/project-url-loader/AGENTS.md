# Project URL Loader Plugin

- Own URL fetching and parsing. Await the initial load in the source-only `prepareInitialProject` hook. Use
  `loadProject` for replacement and leave URL precedence to the composition.
- Treat valid empty source as a successful load. Reject fetch or parser failures unless the composition explicitly
  selects an empty-project fallback. Ignore late results after disposal. Keep installation errors distinct from I/O failures.
