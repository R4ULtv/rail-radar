import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const response = result.response;

  if (response) {
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  }

  return result;
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders, csrfMiddleware],
}));
