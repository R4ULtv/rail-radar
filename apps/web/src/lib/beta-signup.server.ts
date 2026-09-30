import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { getRequestHeader } from "@tanstack/react-start/server";

const RESEND_API_URL = "https://api.resend.com";
const ANDROID_BETA_SEGMENT_ID = "1f0b11c0-7d44-4e25-b805-542919700011";
// Alias of the published Resend template; the source lives in apps/web/emails.
const WELCOME_TEMPLATE = "android-beta-welcome";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type JoinBetaResult = { status: "joined" | "invalid" | "rate-limited" | "failed" };

export async function joinAndroidBeta(email: string): Promise<JoinBetaResult> {
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { status: "invalid" };

  const ip = getRequestHeader("cf-connecting-ip") ?? "unknown";
  const { success } = await env.SIGNUP_RATE_LIMITER.limit({ key: ip });
  if (!success) return { status: "rate-limited" };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Android beta signup failed: RESEND_API_KEY is not set");
    return { status: "failed" };
  }

  const resend = (path: string, init: RequestInit = {}) =>
    fetch(`${RESEND_API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

  if (!(await addToSegment(resend, email))) return { status: "failed" };

  // The tester is on the list at this point, so a failed welcome email only gets logged.
  const response = await resend("/emails", {
    method: "POST",
    // Resend drops repeats of the same key for 24 hours, so a double submit sends one email.
    headers: { "Idempotency-Key": `${WELCOME_TEMPLATE}/${await sha256(email)}` },
    body: JSON.stringify({
      to: email,
      template: { id: WELCOME_TEMPLATE },
      tags: [{ name: "category", value: "android_beta_welcome" }],
    }),
  });
  if (!response.ok) await logResendError("send the welcome email", response);

  return { status: "joined" };
}

type Resend = (path: string, init?: RequestInit) => Promise<Response>;

/** Creates the contact in the segment, or adds an existing contact to it. */
async function addToSegment(resend: Resend, email: string): Promise<boolean> {
  const created = await resend("/contacts", {
    method: "POST",
    body: JSON.stringify({ email, segments: [{ id: ANDROID_BETA_SEGMENT_ID }] }),
  });
  if (created.ok) return true;
  // Other statuses mean Resend never got to the contact, so retrying won't help.
  if (created.status >= 500 || [401, 403, 429].includes(created.status)) {
    await logResendError("create the contact", created);
    return false;
  }

  const contactPath = `/contacts/${encodeURIComponent(email)}/segments`;
  const added = await resend(`${contactPath}/${ANDROID_BETA_SEGMENT_ID}`, { method: "POST" });
  if (added.ok) return true;

  // Someone signing up twice is already in the segment, which counts as joined.
  const segments = await resend(contactPath);
  if (segments.ok) {
    const { data } = (await segments.json()) as { data?: { id: string }[] };
    if (data?.some((segment) => segment.id === ANDROID_BETA_SEGMENT_ID)) return true;
  }

  await logResendError("create the contact", created);
  await logResendError("add the contact to the segment", added);
  return false;
}

async function logResendError(action: string, response: Response) {
  console.error(
    `Android beta signup couldn't ${action}: ${response.status}`,
    await response.text(),
  );
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
