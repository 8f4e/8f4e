# Project URL Loader Plugin

- Own URL fetching and parsing. Await the initial load in the source-only `prepareInitialProject` hook. Use
  `loadProject` for replacement and leave URL precedence to the composition.
- Treat valid empty source as a successful load. Report fetch or parser failures after installing an empty fallback.
  Ignore late results after disposal. Keep callback and installation errors distinct from I/O failures.
