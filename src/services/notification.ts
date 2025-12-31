/**
 * Notification Service - Complex 10-deep span example
 *
 * Demonstrates deeply nested operations for notification pipeline:
 * notifications → notificationPipeline → queueNotification → prepareNotification
 *   → validateRecipients → fetchRecipients → loadTemplate → formatEmail → sendEmail
 */

import { Effect, Duration } from "effect"

// ============================================================================
// Domain Types
// ============================================================================

export interface NotificationResult {
  sent: boolean
  recipientCount: number
  template: string
}

// ============================================================================
// Notification Pipeline (10-deep nesting)
// ============================================================================

/**
 * Level 10: Send email (deepest level)
 */
const sendEmail = Effect.gen(function* () {
  yield* Effect.log("Sending notification email")
  yield* Effect.annotateCurrentSpan("email.provider", "sendgrid")
  yield* Effect.sleep(Duration.millis(3))
  return { sent: true }
}).pipe(Effect.withSpan("sendEmail"))

/**
 * Level 9: Format email content
 */
const formatEmail = Effect.gen(function* () {
  yield* Effect.log("Formatting email content")
  yield* Effect.sleep(Duration.millis(2))
  yield* sendEmail
  return { formatted: true }
}).pipe(Effect.withSpan("formatEmail"))

/**
 * Level 8: Load email template
 */
const loadTemplate = Effect.gen(function* () {
  yield* Effect.log("Loading email template")
  yield* Effect.annotateCurrentSpan("template.name", "user-notification")
  yield* Effect.sleep(Duration.millis(5))
  yield* formatEmail
  return { template: "user-notification" }
}).pipe(Effect.withSpan("loadTemplate"))

/**
 * Level 7: Fetch recipient list
 */
const fetchRecipients = Effect.gen(function* () {
  yield* Effect.log("Fetching notification recipients")
  yield* Effect.sleep(Duration.millis(10))
  yield* loadTemplate
  return { recipientCount: 5 }
}).pipe(Effect.withSpan("fetchRecipients"))

/**
 * Level 6: Validate recipients
 */
const validateRecipients = Effect.gen(function* () {
  yield* Effect.log("Validating recipient list")
  yield* Effect.sleep(Duration.millis(3))
  yield* fetchRecipients
  return { valid: true }
}).pipe(Effect.withSpan("validateRecipients"))

/**
 * Level 5: Prepare notification payload
 */
const prepareNotification = Effect.gen(function* () {
  yield* Effect.log("Preparing notification payload")
  yield* Effect.sleep(Duration.millis(2))
  yield* validateRecipients
  return { prepared: true }
}).pipe(Effect.withSpan("prepareNotification"))

/**
 * Level 4: Queue notification for processing
 */
const queueNotification = Effect.gen(function* () {
  yield* Effect.log("Queueing notification")
  yield* Effect.annotateCurrentSpan("queue.name", "notifications")
  yield* Effect.sleep(Duration.millis(5))
  yield* prepareNotification
  return { queued: true }
}).pipe(Effect.withSpan("queueNotification"))

/**
 * Level 3: Notification pipeline orchestration
 */
const notificationPipeline = Effect.gen(function* () {
  yield* Effect.log("Starting notification pipeline")
  yield* Effect.sleep(Duration.millis(2))
  yield* queueNotification
  return { pipelineComplete: true }
}).pipe(Effect.withSpan("notificationPipeline"))

/**
 * Level 2: Top-level notifications service
 *
 * Creates 10-deep hierarchy:
 * notifications → notificationPipeline → queueNotification → prepareNotification
 *   → validateRecipients → fetchRecipients → loadTemplate → formatEmail → sendEmail
 */
export const sendNotifications = Effect.gen(function* () {
  yield* Effect.log("Initiating notification service")
  yield* Effect.sleep(Duration.millis(1))
  yield* notificationPipeline

  return {
    sent: true,
    recipientCount: 5,
    template: "user-notification",
  } as NotificationResult
}).pipe(Effect.withSpan("notifications"))
