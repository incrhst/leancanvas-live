import { announcePlanRequired } from "./plan";

/**
 * The message a Convex mutation threw, without the "Uncaught ConvexError:" wrapping.
 * A paywall error opens the plan dialog and reads as its short reason.
 */
export function convexErrorMessage(err: unknown) {
  const data = (err as { data?: unknown })?.data;
  const message =
    typeof data === "string"
      ? data
      : err instanceof Error
        ? err.message.replace(/^.*Uncaught (ConvexError|Error): /, "").split("\n")[0]
        : "Something went wrong";
  return announcePlanRequired(message) ?? message;
}
