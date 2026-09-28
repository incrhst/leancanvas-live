import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

export default convexAuthNextjsMiddleware(undefined, {
  // Magic-link callbacks land on app pages; never treat ?code= on API routes (e.g. OAuth) as a Convex Auth code.
  shouldHandleCode: (request) => !request.nextUrl.pathname.startsWith("/api/"),
  cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
});

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
