# Effect-TS SpanTree Demo

This example demonstrates how **SpanTree** solves the use case from [Effect-TS/effect#5926](https://github.com/Effect-TS/effect/issues/5926):

> "We wrap effects with span metadata and want to log the 'deepest' span path when the effect completes"

## The Problem

When using `Effect.ensuring()` to log span information at the end of an operation, **inner spans have already closed** by the time the finalizer runs. This makes it impossible to query the "deepest path" through the span hierarchy using standard OpenTelemetry APIs.

```typescript
// Without SpanTree - inner spans are gone!
const operation = myEffect.pipe(
  Effect.withSpan("root"),
  Effect.ensuring(
    Effect.sync(() => {
      // By the time this runs, inner spans like "validate", "db.query"
      // have already ended and their hierarchy is lost
      console.log("What was the deepest path?") // Can't answer this!
    })
  )
)
```

## The Solution

SpanTree maintains an in-memory span tree with TTL-based cleanup, allowing queries like `getDeepestPath()` even after inner spans have ended:

```typescript
import { SpanTree } from "effect"

const operation = myEffect.pipe(
  Effect.withSpan("root"),
  Effect.ensuring(
    Effect.gen(function* () {
      const spanTree = yield* SpanTree.SpanTree
      const traceId = spanTree.getCurrentTraceId()
      if (traceId) {
        // SpanTree still has the full hierarchy!
        const summary = spanTree.getTraceSummary(traceId)
        console.log(`Deepest path: ${summary.formattedPath}`)
        // Output: "root -> fetchUser -> validate -> db.query -> transform"
      }
    })
  )
)
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Run the dev server
pnpm dev
```

## Endpoints

| Endpoint | Description | Span Depth |
|----------|-------------|------------|
| `GET /` | Welcome message with API docs | - |
| `GET /health` | Health check | - |
| `GET /api/users/:id` | Simple user fetch | 6 levels |
| `GET /api/complex/:id` | Complex multi-branch operation | 10+ levels |
| `GET /api/audit-logs` | View captured trace summaries | - |

## Example: Simple 6-Deep Span Hierarchy

```bash
curl http://localhost:3000/api/users/1
```

Creates this span hierarchy:
```
api.getUser
  -> fetchUser
    -> validate
      -> checkPermissions
        -> db.query
          -> transform
```

Console output:
```
============================================================
[api.getUser] Trace completed!
  Deepest path: api.getUser -> fetchUser -> validate -> checkPermissions -> db.query -> transform
  Depth: 6 spans
  Total spans: 6
  Trace URL: https://ui.atrim.io/traces/abc123...
============================================================
```

## Example: Complex 10+ Deep Multi-Branch

```bash
curl http://localhost:3000/api/complex/1
```

Creates multiple branches with varying depths:
```
api.complexOperation
  |-- fetchUser (depth 6)
  |     +-- validate -> checkPermissions -> db.query -> transform
  |-- enrichUser (depth 4)
  |     +-- fetchPreferences
  |-- analytics (depth 8)
  |     +-- calculateMetrics -> aggregateData -> computeStats -> finalizeMetrics
  |-- cacheCheck (depth 3)
  +-- notifications (depth 10) <-- DEEPEST
        +-- notificationPipeline -> queueNotification -> prepareNotification
              -> validateRecipients -> fetchRecipients -> loadTemplate
              -> formatEmail -> sendEmail
```

The SpanTree correctly identifies the notifications branch as the deepest path!

## SpanTree API

```typescript
import { SpanTree } from "effect"

// Access the SpanTree service
const spanTree = yield* SpanTree.SpanTree

// Get current trace context
const traceId = spanTree.getCurrentTraceId()
const spanId = spanTree.getCurrentSpanId()

// Query span paths
const deepestPath = spanTree.getDeepestPath(traceId)

// Get full trace summary
const summary = spanTree.getTraceSummary(traceId, {
  traceUrlBase: "https://ui.atrim.io"
})
// Returns: { traceId, path, formattedPath, depth, spanCount, traceUrl }

// Query span details
const allSpans = spanTree.getTraceSpans(traceId)
const leafSpans = spanTree.getLeafSpans(traceId)
```

## Visualizing in Atrim UI

When running with OpenTelemetry instrumentation, SpanTree adds these attributes to spans:

- `span_tree.depth` - The maximum depth achieved in this trace
- `span_tree.deepest_path` - Formatted string of the deepest span path
- `span_tree.span_count` - Total number of spans in the trace
- `span_tree.trace_url` - Link to view the trace in your observability UI

These attributes are visible in the Atrim UI trace view:

![Span Tree Depth Filter](docs/span-tree-depth-filter.png)
*Filter traces by span depth to find complex operations*

![Deepest Path Display](docs/deepest-path-display.png)
*View the formatted deepest path in span details*

## Memory Management

SpanTree includes built-in memory management:

- **TTL cleanup**: Span data is automatically cleared after traces complete (default: 30 seconds)
- **Max limits**: Configurable limits on spans (10,000) and traces (1,000)
- **LRU eviction**: When limits are exceeded, oldest traces are evicted first

## Related Links

- [Effect-TS Issue #5926](https://github.com/Effect-TS/effect/issues/5926) - Original feature request
- [SpanTree PR #2](https://github.com/clayroach/effect/pull/2) - Implementation
- [Atrim Platform](https://atrim.io) - AI-native observability with SpanTree visualization

## License

MIT
