import { query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return { _id: user._id, name: user.name, email: user.email, image: user.image };
  },
});
