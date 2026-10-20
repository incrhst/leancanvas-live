/** The message a Convex mutation threw, without the "Uncaught ConvexError:" wrapping. */
export function convexErrorMessage(err: unknown) {
  const data = (err as { data?: unknown })?.data;
  if (typeof data === "string") return data;
  return err instanceof Error ? err.message.replace(/^.*Uncaught (ConvexError|Error): /, "").split("\n")[0] : "Something went wrong";
}
