# Compiler Worker Guidelines

- Own the worker protocol and compilation dispatch. Keep message types shared at the worker boundary.
- Return compilation artifacts through `memoryRef` and describe memory reuse or replacement through
  `memoryAction`. The editor compiler plugin owns scheduling and result acceptance.
