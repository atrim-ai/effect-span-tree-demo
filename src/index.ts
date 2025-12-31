/**
 * Effect-TS SpanTree Demo
 *
 * This example demonstrates how SpanTree solves the use case from Effect-TS/effect#5926:
 * "Accessing the deepest span path from Effect.ensuring()"
 *
 * The Problem:
 * When using Effect.ensuring() to log span information, inner spans have already
 * closed by the time the finalizer runs. This makes it impossible to query the
 * "deepest path" through the span hierarchy.
 *
 * The Solution:
 * SpanTree maintains an in-memory span tree with TTL-based cleanup, allowing
 * queries like getDeepestPath() even after inner spans have ended.
 *
 * Endpoints:
 * - GET /              - Welcome message
 * - GET /health        - Health check
 * - GET /api/users/:id - Simple 6-level nested span example
 * - GET /api/complex/:id - Complex 10-level notification pipeline
 * - GET /api/audit-logs  - View captured span paths
 */

import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import * as Http from "node:http"

import { fetchUser } from "./services/user.js"
import { sendNotifications } from "./services/notification.js"
import { auditLogs } from "./lib/span-tree-logger.js"

// ============================================================================
// HTTP Routes
// ============================================================================

/**
 * Welcome route - demonstrates basic routing
 */
const welcomeRoute = HttpRouter.get(
  "/",
  Effect.gen(function* () {
    return yield* HttpServerResponse.json({
      message: "Effect-TS SpanTree Demo",
      description: "Demonstrates Effect-TS/effect#5926 - accessing span tree from Effect.ensuring()",
      endpoints: {
        "/api/users/:id": "Simple 6-level nested span example",
        "/api/complex/:id": "Complex 10+ level notification pipeline",
        "/api/audit-logs": "View captured trace summaries",
      },
    })
  })
)

/**
 * Health check route
 */
const healthRoute = HttpRouter.get(
  "/health",
  HttpServerResponse.json({ status: "ok", timestamp: new Date().toISOString() })
)

/**
 * User fetch route - Simple 6-deep span example
 *
 * Creates hierarchy: api.getUser → fetchUser → validate → checkPermissions → db.query → transform
 */
const userRoute = HttpRouter.get(
  "/api/users/:id",
  Effect.gen(function* () {
    const id = "1" // In production, get from route params

    const result = yield* fetchUser(id).pipe(
      Effect.withSpan("api.getUser"),
      Effect.either
    )

    if (result._tag === "Right") {
      return yield* HttpServerResponse.json(result.right)
    } else {
      return yield* HttpServerResponse.json(
        { error: String(result.left) },
        { status: 404 }
      )
    }
  })
)

/**
 * Complex operation route - 10+ deep span example with multiple branches
 *
 * This creates a visually interesting tree for the Atrim UI with varying depths:
 * - User fetch branch (depth ~6)
 * - Enrichment branch (depth ~4)
 * - Analytics branch (depth ~8)
 * - Cache check branch (depth ~3)
 * - Notification pipeline (depth 10) ← DEEPEST
 */
const complexRoute = HttpRouter.get(
  "/api/complex/:id",
  Effect.gen(function* () {
    const id = "1" // In production, get from route params

    const complexOperation = Effect.gen(function* () {
      // Branch 1: User fetch (depth ~6)
      const user = yield* fetchUser(id)

      // Branch 2: Enrichment pipeline (depth 4)
      yield* Effect.gen(function* () {
        yield* Effect.log("Enriching user data")

        yield* Effect.gen(function* () {
          yield* Effect.log("Fetching preferences")
        }).pipe(Effect.withSpan("fetchPreferences"))
      }).pipe(Effect.withSpan("enrichUser"))

      // Branch 3: Deep analytics pipeline (depth 8)
      yield* Effect.gen(function* () {
        yield* Effect.log("Starting analytics")

        yield* Effect.gen(function* () {
          yield* Effect.log("Calculating metrics")

          yield* Effect.gen(function* () {
            yield* Effect.log("Aggregating data")

            yield* Effect.gen(function* () {
              yield* Effect.log("Computing statistics")

              yield* Effect.gen(function* () {
                yield* Effect.log("Finalizing metrics")
              }).pipe(Effect.withSpan("finalizeMetrics"))
            }).pipe(Effect.withSpan("computeStats"))
          }).pipe(Effect.withSpan("aggregateData"))
        }).pipe(Effect.withSpan("calculateMetrics"))
      }).pipe(Effect.withSpan("analytics"))

      // Branch 4: Shallow cache check (depth 3)
      yield* Effect.gen(function* () {
        yield* Effect.log("Checking cache")
      }).pipe(Effect.withSpan("cacheCheck"))

      // Branch 5: Very deep notification pipeline (depth 10)
      yield* sendNotifications

      return user
    })

    const result = yield* complexOperation.pipe(
      Effect.withSpan("api.complexOperation"),
      Effect.either
    )

    if (result._tag === "Right") {
      return yield* HttpServerResponse.json({
        user: result.right,
        message: "Complex operation completed - check console for span tree output",
      })
    } else {
      return yield* HttpServerResponse.json(
        { error: String(result.left) },
        { status: 500 }
      )
    }
  })
)

/**
 * Audit logs route - View captured trace summaries
 */
const auditRoute = HttpRouter.get(
  "/api/audit-logs",
  HttpServerResponse.json(auditLogs)
)

// ============================================================================
// Router Composition
// ============================================================================

const router = HttpRouter.empty.pipe(
  welcomeRoute,
  healthRoute,
  userRoute,
  complexRoute,
  auditRoute
)

// ============================================================================
// Server Setup
// ============================================================================

const ServerLive = NodeHttpServer.layer(() => Http.createServer(), { port: 3000 })

const HttpLive = router.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(ServerLive)
)

// ============================================================================
// Main
// ============================================================================

console.log(`
${"=".repeat(60)}
Effect-TS SpanTree Demo
Demonstrates Effect-TS/effect#5926 solution
${"=".repeat(60)}

Starting server on http://localhost:3000

Endpoints:
  GET /                  - Welcome message
  GET /health            - Health check
  GET /api/users/:id     - Simple 6-level nested span example
  GET /api/complex/:id   - Complex 10+ level notification pipeline
  GET /api/audit-logs    - View captured trace summaries

Try these commands:
  curl http://localhost:3000/api/users/1
  curl http://localhost:3000/api/complex/1
  curl http://localhost:3000/api/audit-logs

${"=".repeat(60)}
Watch the console for span path logging from Effect.ensuring()!
${"=".repeat(60)}
`)

NodeRuntime.runMain(Layer.launch(HttpLive))
