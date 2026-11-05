/** How often an open, visible canvas says it's still here. The server drops anyone silent for 25 seconds. */
export const HEARTBEAT_MS = 15_000;
/** Someone back within this long stepped away (a hidden tab, a reload), so they aren't announced again. */
export const REANNOUNCE_AFTER_MS = 5 * 60_000;

/** Who in `present` has just arrived, given when each person was last seen. Times are the server's, so clocks can't disagree. */
export function findArrivals<T extends { userId: string; updatedAt: number }>(lastSeen: ReadonlyMap<string, number>, present: T[]): T[] {
  return present.filter((person) => {
    const last = lastSeen.get(person.userId);
    return last === undefined || person.updatedAt - last > REANNOUNCE_AFTER_MS;
  });
}
