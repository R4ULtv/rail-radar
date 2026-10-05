import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { getRequestHeader } from "@tanstack/react-start/server";

const RESEND_API_URL = "https://api.resend.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignupList = {
  /** Names the list in the logs. */
  name: string;
  segmentId: string;
  /** Alias of a published Resend template sent after joining; the source lives in apps/web/emails. */
  welcome?: { template: string; category: string };
};

const ANDROID_BETA: SignupList = {
  name: "Android beta",
  segmentId: "1f0b11c0-7d44-4e25-b805-542919700011",
  welcome: { template: "android-beta-welcome", category: "android_beta_welcome" },
};

// A waitlist only, so there's no welcome email promising an invite.
const IOS_WAITLIST: SignupList = {
  name: "iOS waitlist",
  segmentId: "69610b76-6412-46a3-83b2-74fd0adff287",
};

export type JoinBetaResult = { status: "joined" | "invalid" | "rate-limited" | "failed" };

export function joinAndroidBeta(email: string): Promise<JoinBetaResult> {
  return joinList(ANDROID_BETA, email);
}

export function joinIosWaitlist(email: string): Promise<JoinBetaResult> {
  return joinList(IOS_WAITLIST, email);
}

async function joinList(list: SignupList, email: string): Promise<JoinBetaResult> {
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { status: "invalid" };

  const ip = getRequestHeader("cf-connecting-ip") ?? "unknown";
  const { success } = await env.SIGNUP_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    console.warn(`${list.name} signup rate-limited`);
    return { status: "rate-limited" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`${list.name} signup failed: RESEND_API_KEY is not set`);
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

  if (!(await addToSegment(resend, list, email))) return { status: "failed" };
  console.info(`${list.name} signup joined`);

  if (list.welcome) {
    // The contact is on the list at this point, so a failed welcome email only gets logged.
    const { template, category } = list.welcome;
    const response = await resend("/emails", {
      method: "POST",
      // Resend drops repeats of the same key for 24 hours, so a double submit sends one email.
      headers: { "Idempotency-Key": `${template}/${await sha256(email)}` },
      body: JSON.stringify({
        to: email,
        template: { id: template },
        tags: [{ name: "category", value: category }],
      }),
    });
    if (!response.ok) await logResendError(list, "send the welcome email", response);
  }

  return { status: "joined" };
}

type Resend = (path: string, init?: RequestInit) => Promise<Response>;

/** Creates the contact in the list's segment, or adds an existing contact to it. */
async function addToSegment(resend: Resend, list: SignupList, email: string): Promise<boolean> {
  const created = await resend("/contacts", {
    method: "POST",
    body: JSON.stringify({ email, segments: [{ id: list.segmentId }] }),
  });
  if (created.ok) return true;
  // Other statuses mean Resend never got to the contact, so retrying won't help.
  if (created.status >= 500 || [401, 403, 429].includes(created.status)) {
    await logResendError(list, "create the contact", created);
    return false;
  }

  const contactPath = `/contacts/${encodeURIComponent(email)}/segments`;
  const added = await resend(`${contactPath}/${list.segmentId}`, { method: "POST" });
  if (added.ok) return true;

  // Someone signing up twice is already in the segment, which counts as joined.
  const segments = await resend(contactPath);
  if (segments.ok) {
    const { data } = (await segments.json()) as { data?: { id: string }[] };
    if (data?.some((segment) => segment.id === list.segmentId)) return true;
  }

  await logResendError(list, "create the contact", created);
  await logResendError(list, "add the contact to the segment", added);
  return false;
}

async function logResendError(list: SignupList, action: string, response: Response) {
  console.error(
    `${list.name} signup couldn't ${action}: ${response.status}`,
    await response.text(),
  );
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
