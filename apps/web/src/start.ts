import { createMiddleware, createStart } from "@tanstack/react-start";

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next();
  result.response.headers.set("X-Content-Type-Options", "nosniff");
  result.response.headers.set("X-Frame-Options", "DENY");
  result.response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}));
