# CLAUDE.md - AI Context for Effect SpanTree Demo

## Project Overview

Effect-TS example application demonstrating SpanTree functionality from [Effect-TS/effect#5926](https://github.com/Effect-TS/effect/issues/5926). Shows how to access span hierarchy information from `Effect.ensuring()` after inner spans have closed.

**Primary Goals:**
1. Demonstrate the SpanTree concept for accessing span hierarchy after spans close
2. Compare instrumentation approaches: show that `@atrim/instrument-node` requires less code than native OTel instrumentation
3. Use git diffs between branches to illustrate the difference in lines of code

## Branch Structure

### Branch Purposes

- **`main`** - Working application WITHOUT any instrumentation (baseline for comparison)
- **`otel-instrumented`** - Native OpenTelemetry instrumentation (manual SDK setup)
- **`atrim-instrumented`** - Uses `@atrim/instrument-node` library (simplified setup)

### Keeping Branches in Sync

The instrumented branches must stay synchronized with `main` for core application code. They should ONLY contain additional code required for instrumentation.

**Standard workflow when updating core code:**
1. Make changes on `main`
2. Merge `main` into both instrumented branches:
   ```bash
   git checkout otel-instrumented && git merge main
   git checkout atrim-instrumented && git merge main
   ```
3. Push all branches to keep them synced locally and remotely

**Branch reset workflow (when instrumented branches have 3+ commits):**

When an instrumented branch accumulates 3 or more commits, reset it to maintain a clean diff:

1. Create a patch from the current instrumented branch:
   ```bash
   git checkout otel-instrumented
   git diff main > /tmp/otel-instrumentation.patch
   ```
2. Create a fresh branch from main:
   ```bash
   git checkout main
   git checkout -b otel-instrumented-new
   git apply /tmp/otel-instrumentation.patch
   git add -A && git commit -m "feat: add OpenTelemetry instrumentation"
   ```
3. Replace the old branch:
   ```bash
   git branch -D otel-instrumented
   git branch -m otel-instrumented-new otel-instrumented
   git push origin otel-instrumented --force
   ```
4. Repeat for `atrim-instrumented` if needed
5. Ensure all branches are synced locally before proceeding with new work

## Code Style for Instrumented Branches

**No comments in instrumentation code.** Changes on instrumented branches should be self-documenting. The git diff against `main` serves as the documentation showing exactly what instrumentation requires.

**Minimize code additions.** Only add what is strictly necessary for instrumentation to function. This keeps diffs clean and demonstrates the true cost of each approach.

## Quick Commands

```bash
pnpm install    # Install dependencies
pnpm dev        # Run dev server (port 3000)
pnpm build      # Build for production
pnpm typecheck  # Type check
```

## Comparing Instrumentation Approaches

To see the difference between approaches:

```bash
# Lines added for OTel native instrumentation
git diff main..otel-instrumented --stat

# Lines added for Atrim instrumentation
git diff main..atrim-instrumented --stat

# Side-by-side diff of a specific file
git diff main..otel-instrumented -- src/index.ts
git diff main..atrim-instrumented -- src/index.ts
```

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
```

## Dependencies

**main branch (baseline):**
- `effect`: `npm:@clayroach/effect@latest` (fork with SpanTree)
- `@effect/platform`: HTTP server
- `@effect/platform-node`: Node.js runtime

**otel-instrumented adds:**
- `@effect/opentelemetry`: Effect-OTel integration
- `@opentelemetry/api`: OTel API
- `@opentelemetry/sdk-trace-*`: OTel SDK packages
- `@opentelemetry/exporter-trace-otlp-http`: OTLP exporter

**atrim-instrumented adds:**
- `@atrim/instrument-node`: Atrim instrumentation (bundles OTel SDK)
- `@opentelemetry/api`: OTel API (required peer dependency)
- `@effect/opentelemetry`: Effect-OTel integration

## Common Pitfalls

- SpanTree service must be provided in the Effect layer
- getCurrentTraceId() returns null if no active trace
- Span attributes are only visible if OpenTelemetry is configured
- Always run `pnpm typecheck` before committing on any branch
