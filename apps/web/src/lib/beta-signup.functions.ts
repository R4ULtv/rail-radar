import { createServerFn } from "@tanstack/react-start";
import { joinAndroidBeta } from "@/lib/beta-signup.server";

export const joinBeta = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => ({ email: String(data.email).trim().toLowerCase() }))
  .handler(({ data }) => joinAndroidBeta(data.email));
