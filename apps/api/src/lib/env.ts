import { createFactory } from "hono/factory";

export type Bindings = Cloudflare.Env;

export type Variables = {
  clientIp: string;
  requestId: string;
  requestStartedAt: number;
};

export type Env = {
  Bindings: Bindings;
  Variables: Variables;
};

export const factory = createFactory<Env>();
