import { createServerFn } from "@tanstack/react-start";
import { joinAndroidBeta, joinIosWaitlist } from "@/lib/beta-signup.server";

const validateEmail = (data: { email: string }) => ({
  email: String(data.email).trim().toLowerCase(),
});

export const joinBeta = createServerFn({ method: "POST" })
  .validator(validateEmail)
  .handler(({ data }) => joinAndroidBeta(data.email));

export const joinIphoneWaitlist = createServerFn({ method: "POST" })
  .validator(validateEmail)
  .handler(({ data }) => joinIosWaitlist(data.email));
