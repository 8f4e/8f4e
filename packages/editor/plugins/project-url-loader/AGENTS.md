# Project URL Loader Plugin

- Own URL fetching and parsing. Await the initial load in the pre-render `init` hook. Use `loadProject` for
  replacement and leave URL precedence to the composition.
- Notify after source installation, including valid empty source. Ignore late results after disposal. Keep
  callback and installation errors distinct from I/O failures.
