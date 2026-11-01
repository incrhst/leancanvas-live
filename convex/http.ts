import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { webhook as dimepayWebhook } from "./payments";

const http = httpRouter();

auth.addHttpRoutes(http);

// Set as the webhook URL in the DIME PAY dashboard: <CONVEX_SITE_URL>/dimepay/webhook
http.route({ path: "/dimepay/webhook", method: "POST", handler: dimepayWebhook });

export default http;
