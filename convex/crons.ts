import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Monday 13:00 UTC is 8am in Jamaica
crons.weekly("weekly check-in", { dayOfWeek: "monday", hourUTC: 13, minuteUTC: 0 }, internal.checkIns.startWeek, {});

export default crons;
