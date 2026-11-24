# Logger Feature

## Purpose

Provides a centralized logging system for the editor. Appends categorized log messages to the console state with timestamps and level indicators. Messages are capped to prevent unbounded memory growth.

## Key Behaviors

- **Message Appending**: Adds log entries to `state.console.logs` array
- **Categorization**: Tags messages with optional category labels
- **Timestamping**: Automatically adds HH:MM:SS timestamps to all entries
- **Level Support**: Supports log, warn, error, and info severity levels
- **Automatic Capping**: Limits total log count to `state.console.maxLogs` (older entries are dropped)

## Log Levels

- **`log`** - General informational messages
- **`info`** - Informational messages
- **`warn`** - Warning messages
- **`error`** - Error messages

## API Functions

```typescript
log(state: State, message: string, category?: string): void
warn(state: State, message: string, category?: string): void
error(state: State, message: string, category?: string): void
info(state: State, message: string, category?: string): void
```

## Log Entry Format

```typescript
{
  level: 'log' | 'warn' | 'error' | 'info',
  message: string,
  category?: string,  // Formatted as [CategoryName]
  timestamp: string   // Formatted as [HH:MM:SS]
}
```

## State Touched

- `state.console.logs` - Array of log message objects
- `state.console.maxLogs` - Maximum number of log entries to retain (default configuration)

## Integration Points

- **Compiler**: Logs compilation success/failure messages
- **Runtime**: Logs runtime initialization and destruction
- Used throughout editor features for diagnostic output

## Notes & Limitations

- Logs are kept in memory only (not persisted)
- Oldest logs are automatically dropped when maxLogs is exceeded
- No built-in UI, filtering, or search is provided
- Timestamp resolution is seconds (HH:MM:SS format)
