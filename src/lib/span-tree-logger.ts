/**
 * SpanTree Logger Utility
 *
 * This module demonstrates the key use case from Effect-TS/effect#5926:
 * Using Effect.ensuring() to log span tree information after inner spans complete.
 *
 * The Problem:
 * When using Effect.ensuring() to log span information, inner spans have already
 * closed by the time the finalizer runs. This makes it impossible to query the
 * "deepest path" through the span hierarchy using standard OpenTelemetry APIs.
 *
 * The Solution:
 * SpanTree maintains an in-memory span tree, allowing queries like getDeepestPath()
 * even after inner spans have ended.
 */

import { Effect, Context, Tracer } from "effect"

// ============================================================================
// SpanTree Service Definition
// ============================================================================

/**
 * SpanTree summary result from getTraceSummary()
 */
export interface TraceSummary {
  traceId: string
  path: readonly string[]
  formattedPath: string
  depth: number
  spanCount: number
  traceUrl: string | null
}

/**
 * SpanTree service interface
 * This matches the API from @clayroach/effect's SpanTree module
 */
export interface SpanTree {
  readonly getCurrentTraceId: () => string | null
  readonly getCurrentSpanId: () => string | null
  readonly getDeepestPath: (traceId: string) => readonly string[]
  readonly getTraceSummary: (
    traceId: string,
    options?: { traceUrlBase?: string }
  ) => TraceSummary
  readonly getTraceSpans: (traceId: string) => ReadonlyArray<{
    spanId: string
    name: string
    parentSpanId: string | null
  }>
  readonly getLeafSpans: (traceId: string) => ReadonlyArray<{
    spanId: string
    name: string
  }>
  readonly isEnabled: () => boolean
}

/**
 * SpanTree service tag
 */
export class SpanTreeService extends Context.Tag("SpanTree")<
  SpanTreeService,
  SpanTree
>() {}

// ============================================================================
// Audit Log Storage
// ============================================================================

export interface AuditLog {
  traceId: string
  deepestPath: string
  depth: number
  spanCount: number
  timestamp: Date
  traceUrl: string | null
}

// In-memory audit log storage (in production, use a database)
export const auditLogs: AuditLog[] = []

// ============================================================================
// SpanTree Logger Combinator
// ============================================================================

/**
 * Wrap an Effect with span path logging using Effect.ensuring()
 *
 * This demonstrates the exact use case from Effect-TS/effect#5926:
 * - The finalizer runs after ALL inner spans have ended
 * - Without SpanTree, we'd have no way to know the deepest path
 * - With SpanTree, we can query the full hierarchy even after spans end
 *
 * @example
 * ```typescript
 * const userFetch = fetchUser("123")
 * const logged = withSpanLogging(userFetch, "api.getUser")
 *
 * // Console output after execution:
 * // [api.getUser] Trace completed!
 * //   Deepest path: api.getUser → fetchUser → validate → db.query
 * //   Depth: 4 spans
 * //   Total spans: 4
 * ```
 */
export const withSpanLogging = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  operationName: string,
  options: { traceUrlBase?: string } = {}
) =>
  Effect.gen(function* () {
    const spanTree = yield* SpanTreeService

    // Get trace ID at the start (before inner spans exist)
    const traceId = spanTree.getCurrentTraceId()

    if (!traceId) {
      console.log(`[${operationName}] No trace ID - SpanTree may not be initialized`)
      return yield* effect
    }

    // Run the effect with ensuring to log after ALL inner spans complete
    const result = yield* effect.pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          // THIS IS THE KEY: Even though inner spans have ended,
          // SpanTree still has their data and we can query it!
          const summary = spanTree.getTraceSummary(traceId, {
            traceUrlBase: options.traceUrlBase ?? "https://ui.atrim.io",
          })

          // Add span attributes so depth/path are visible in trace UI
          yield* Effect.annotateCurrentSpan("span_tree.depth", summary.depth)
          yield* Effect.annotateCurrentSpan(
            "span_tree.deepest_path",
            summary.formattedPath
          )
          yield* Effect.annotateCurrentSpan("span_tree.span_count", summary.spanCount)
          if (summary.traceUrl) {
            yield* Effect.annotateCurrentSpan("span_tree.trace_url", summary.traceUrl)
          }

          // Log the deepest path achieved
          console.log(`\n${"=".repeat(60)}`)
          console.log(`[${operationName}] Trace completed!`)
          console.log(`  Deepest path: ${summary.formattedPath}`)
          console.log(`  Depth: ${summary.depth} spans`)
          console.log(`  Total spans: ${summary.spanCount}`)
          if (summary.traceUrl) {
            console.log(`  Trace URL: ${summary.traceUrl}`)
          }
          console.log("=".repeat(60) + "\n")

          // Store audit log
          auditLogs.push({
            traceId,
            deepestPath: summary.formattedPath,
            depth: summary.depth,
            spanCount: summary.spanCount,
            timestamp: new Date(),
            traceUrl: summary.traceUrl,
          })
        })
      )
    )

    return result
  }).pipe(Effect.withSpan(operationName))

// ============================================================================
// Mock SpanTree Implementation (for demo without full instrumentation)
// ============================================================================

/**
 * Create a mock SpanTree layer for demonstration purposes.
 * In production, use SpanTree.layer() from @clayroach/effect with OpenTelemetry.
 */
export const mockSpanTreeLayer = Effect.provideService(
  Effect.void,
  SpanTreeService,
  {
    getCurrentTraceId: () => `trace-${Date.now()}`,
    getCurrentSpanId: () => `span-${Date.now()}`,
    getDeepestPath: () => ["root", "child1", "child2"],
    getTraceSummary: (traceId, options) => ({
      traceId,
      path: ["root", "child1", "child2"],
      formattedPath: "root → child1 → child2",
      depth: 3,
      spanCount: 3,
      traceUrl: options?.traceUrlBase
        ? `${options.traceUrlBase}/traces/${traceId}`
        : null,
    }),
    getTraceSpans: () => [],
    getLeafSpans: () => [],
    isEnabled: () => true,
  }
)
