# CLAUDE.md - AI Context for Effect SpanTree Demo

## Project Overview

Effect-TS example application demonstrating SpanTree functionality from [Effect-TS/effect#5926](https://github.com/Effect-TS/effect/issues/5926). Shows how to access span hierarchy information from `Effect.ensuring()` after inner spans have closed.

## Key Concepts

### SpanTree Purpose
- Maintains in-memory span tree with TTL-based cleanup
- Allows querying span hierarchy after spans close
- Solves the problem of logging "deepest path" in finalizers

### Span Depth Examples
- **Simple (6-deep)**: `/api/users/:id` - User fetch chain
- **Complex (10-deep)**: `/api/complex/:id` - Multi-branch notification pipeline

## File Structure

```
src/
  index.ts                    # HTTP server with routes
  services/
    user.ts                   # 6-deep user fetch example
    notification.ts           # 10-deep notification pipeline
  lib/
    span-tree-logger.ts       # SpanTree utility wrapper
```

## Quick Commands

```bash
pnpm install    # Install dependencies
pnpm dev        # Run dev server (port 3000)
pnpm build      # Build for production
pnpm typecheck  # Type check
```

## Branch Structure

- `main` - Base code without instrumentation (for diff comparison)
- `atrim-instrumented` - Auto-instrumentation via instrumentation.yaml
- `otel-instrumented` - Manual OTel spans

## Key Patterns

### withSpanLogging Combinator
```typescript
const withSpanLogging = (effect, operationName) =>
  Effect.gen(function* () {
    const spanTree = yield* SpanTree.SpanTree
    const traceId = spanTree.getCurrentTraceId()

    return yield* effect.pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          // Query span tree AFTER inner spans closed
          const summary = spanTree.getTraceSummary(traceId)
          yield* Effect.annotateCurrentSpan("span_tree.depth", summary.depth)
        })
      )
    )
  }).pipe(Effect.withSpan(operationName))
```

### Deeply Nested Effects
```typescript
// Create deep nesting with Effect.gen + Effect.withSpan
Effect.gen(function* () {
  yield* Effect.gen(function* () {
    yield* Effect.gen(function* () {
      // ... deeper nesting
    }).pipe(Effect.withSpan("level3"))
  }).pipe(Effect.withSpan("level2"))
}).pipe(Effect.withSpan("level1"))
```

## Dependencies

- `effect`: `npm:@clayroach/effect@latest` (fork with SpanTree)
- `@effect/platform`: HTTP server
- `@effect/platform-node`: Node.js runtime

## Common Pitfalls

- SpanTree service must be provided in the Effect layer
- getCurrentTraceId() returns null if no active trace
- Span attributes are only visible if OpenTelemetry is configured
