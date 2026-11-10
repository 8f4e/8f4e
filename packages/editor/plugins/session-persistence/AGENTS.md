# Session Persistence Plugin

- Restore from injected storage during pre-render `init`. Leave project serialization, replacement and
  revision tracking in core.
- Autosave once per completed `state.projectChange` after derived state settles. Keep autosave active when
  restoration is disabled.
