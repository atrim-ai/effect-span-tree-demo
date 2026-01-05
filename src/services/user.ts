/**
 * User Service - Simple 6-deep span example
 *
 * Demonstrates a realistic user fetch operation with nested operations:
 * api.getUser → fetchUser → validate → checkPermissions → db.query → transform
 */

import { Effect, Duration, Data } from "effect"

// ============================================================================
// Domain Types
// ============================================================================

export class InvalidUserIdError extends Data.TaggedError("InvalidUserIdError")<{
  readonly userId: string
}> {}

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly userId: string
}> {}

export interface User {
  id: string
  name: string
  email: string
}

export interface TransformedUser extends User {
  displayName: string
}

// Mock data
const mockUsers: Record<string, User> = {
  "1": { id: "1", name: "Alice", email: "alice@example.com" },
  "2": { id: "2", name: "Bob", email: "bob@example.com" },
  "3": { id: "3", name: "Charlie", email: "charlie@example.com" },
}

// ============================================================================
// User Service Operations (6-deep nesting)
// ============================================================================

/**
 * Level 6: Validate user ID format
 */
export const validateUserId = (userId: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`Validating user ID: ${userId}`)
    yield* Effect.sleep(Duration.millis(10))

    if (!userId.match(/^\d+$/)) {
      return yield* Effect.fail(new InvalidUserIdError({ userId }))
    }

    return userId
  }).pipe(Effect.withSpan("validate"))

/**
 * Level 5: Check user permissions
 */
export const checkPermissions = (userId: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`Checking permissions for user: ${userId}`)
    yield* Effect.sleep(Duration.millis(15))
    return true
  }).pipe(Effect.withSpan("checkPermissions"))

/**
 * Level 4: Query database for user
 */
export const queryDatabase = (userId: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`Querying database for user: ${userId}`)

    // Add database-specific span attributes
    yield* Effect.annotateCurrentSpan("db.system", "postgresql")
    yield* Effect.annotateCurrentSpan(
      "db.statement",
      `SELECT * FROM users WHERE id = $1`
    )

    yield* Effect.sleep(Duration.millis(50))

    const user = mockUsers[userId]
    if (!user) {
      return yield* Effect.fail(new UserNotFoundError({ userId }))
    }

    return user
  }).pipe(Effect.withSpan("db.query"))

/**
 * Level 3: Transform user data for response
 */
export const transformUser = (user: User): Effect.Effect<TransformedUser> =>
  Effect.gen(function* () {
    yield* Effect.log(`Transforming user data`)
    yield* Effect.sleep(Duration.millis(5))
    return {
      ...user,
      displayName: `${user.name} <${user.email}>`,
    }
  }).pipe(Effect.withSpan("transform"))

/**
 * Level 2: Fetch user with nested operations
 *
 * Creates hierarchy: fetchUser → validate → checkPermissions → db.query → transform
 */
export const fetchUser = (userId: string): Effect.Effect<TransformedUser, InvalidUserIdError | UserNotFoundError> =>
  Effect.gen(function* () {
    yield* Effect.log(`Starting user fetch for: ${userId}`)

    // Nested operations create deep span hierarchy
    const validatedId = yield* validateUserId(userId)
    yield* checkPermissions(validatedId)
    const user = yield* queryDatabase(validatedId)
    const transformed = yield* transformUser(user)

    return transformed
  }).pipe(Effect.withSpan("fetchUser"))
