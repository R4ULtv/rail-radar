import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { joinBeta, joinIphoneWaitlist } from "@/lib/beta-signup.functions";
import { metadataToHead, type Metadata } from "@/lib/metadata";
import { MIN_ANDROID_VERSION, useDeviceCheck, type DeviceCheck } from "@/hooks/use-device-check";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { cn } from "@repo/ui/lib/utils";
import {
  ArrowLeftIcon,
  BellIcon,
  BookmarkIcon,
  CheckIcon,
  CircleDashedIcon,
  GiftIcon,
  MegaphoneIcon,
  LocateFixedIcon,
  MapPinIcon,
  MoonIcon,
  SunIcon,
  TicketIcon,
  TrainFrontIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => metadataToHead(metadata),
  component: AppPage,
});

const metadata: Metadata = {
  title: "Mobile App",
  description:
    "Join the Rail Radar Android beta on Google Play or get notified when the iPhone app is available.",
  alternates: {
    canonical: "/app",
  },
};

const TEST_DAYS = 14;
const APP_PRICE = "€3";
const FREE_BETA_PLACES = 20;
const GOOGLE_MAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const steps = [
  {
    title: "Sign up",
    description: "Leave the email of the Google account you use on the Play Store.",
  },
  {
    title: "Get the invite",
    description: `Once we add you to the test, you'll get an email with a link to join it on Google Play. If you receive one of the ${FREE_BETA_PLACES} free places, your invite will include a promo code.`,
  },
  {
    title: "Install from Google Play",
    description:
      "Open the link on your phone and accept the invite. Then buy Rail Radar, redeem your promo code, or wait for the public release.",
  },
  {
    title: `Keep it for at least ${TEST_DAYS} days`,
    description:
      "If you install the beta, keep it until the app launches. Google counts testers every day, and every bug you report helps.",
  },
];

type Appearance = "dark" | "light";
type AppPlatform = "android" | "ios";

// Android emulator screenshots, taken in the same scene in dark and light mode.
const screens = [
  {
    name: "map",
    alt: "The Rail Radar app showing train stations on a street map of Milan.",
    title: "Every station on the map",
    description: "22,000+ stations in 14 countries, on a simple or street map.",
  },
  {
    name: "departures",
    alt: "The Rail Radar app showing live departures from Milano Centrale, with platforms and trains departing.",
    title: "Live departures",
    description: "Platforms, delays and statuses, refreshed every 30 seconds.",
  },
];

const mobileFeatures = [
  {
    icon: MapPinIcon,
    title: "Nearby departures, one tap away",
    description:
      "Tap Nearby to open your closest station's live departures. Switch between the three nearest train stations, with distances shown.",
  },
  {
    icon: WifiOffIcon,
    title: "Search without a connection",
    description:
      "Every station is stored on your phone, so you can search even offline. Live departures need an internet connection.",
  },
  {
    icon: BookmarkIcon,
    title: "Search that puts your stations first",
    description:
      "Matching saved and recent stations come first. Nearby matches rank higher, with distances shown when location is enabled.",
  },
  {
    icon: LocateFixedIcon,
    title: "Follow your position on the map",
    description:
      "Tap Locate to follow your live position as you move. Pan the map whenever you want to explore somewhere else.",
  },
];

function AppPage() {
  const [appearance, setAppearance] = useState<Appearance>("dark");
  const device = useDeviceCheck();
  const [selectedPlatform, setSelectedPlatform] = useState<AppPlatform | null>(null);
  // Phones preselect their own platform. Desktops have to pick, since the signup can't tell.
  const platform =
    selectedPlatform ??
    (device.platform === "android" || device.platform === "ios" ? device.platform : null);
  const isIos = platform === "ios";

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-16 md:px-6 md:py-16">
      <Link
        to="/"
        className="group/back mb-6 md:mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-150 ease-out group-hover/back:-translate-x-0.5" />
        Back to Rail Radar
      </Link>

      {/* Everything above the signup is the same on every device, so the prerendered page
          doesn't shift once the platform is detected. */}
      <BetaBoard />

      <div className="mt-8 mb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Get Rail Radar on your phone before launch.
        </h1>
        <p className="mt-3 text-muted-foreground text-pretty">
          Find nearby departures, search stations offline and follow your position on the map. Join
          the Android beta now, or get on the iPhone waitlist.
        </p>
      </div>

      <SignupCard platform={platform} onPlatformChange={setSelectedPlatform} />

      <section className="mt-12">
        <SectionHeading>What the app adds</SectionHeading>
        <p className="mb-6 text-sm leading-6 text-muted-foreground text-pretty">
          The same European railway coverage as the website, with more ways to find your next
          station on the go.
        </p>
        <ul className="divide-y divide-border">
          {mobileFeatures.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-blue-600 dark:text-blue-400">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-medium tracking-tight">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <SectionHeading>
          {isIos ? "A look at the Android app" : "What you'll be testing"}
        </SectionHeading>
        <ToggleGroup
          value={[appearance]}
          onValueChange={(value) => {
            const selected = value[0];
            if (selected) setAppearance(selected as Appearance);
          }}
          size="sm"
          variant="outline"
          spacing={0}
          aria-label="Screenshot appearance"
          className="-mt-2 mb-4 ml-auto"
        >
          <ToggleGroupItem value="dark" className="h-7 gap-1 px-2.5 text-xs">
            <MoonIcon className="size-3.5" />
            Dark
          </ToggleGroupItem>
          <ToggleGroupItem value="light" className="h-7 gap-1 px-2.5 text-xs">
            <SunIcon className="size-3.5" />
            Light
          </ToggleGroupItem>
        </ToggleGroup>
        <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0">
          {screens.map((screen) => (
            <li key={screen.name} className="w-[72%] shrink-0 snap-center sm:w-auto">
              <Screenshot name={screen.name} alt={screen.alt} appearance={appearance} />
              <h3 className="mt-4 text-sm font-medium tracking-tight">{screen.title}</h3>
              <p className="mt-0.5 text-sm leading-6 text-muted-foreground text-pretty">
                {screen.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {!isIos && (
        <section className="mt-12">
          <SectionHeading>What you need</SectionHeading>
          <Requirements />
        </section>
      )}

      {!isIos && (
        <section className="mt-12">
          <SectionHeading>How the beta works</SectionHeading>
          <ol>
            {steps.map((step, index) => (
              <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-5 bottom-0 left-[9px] w-0.5 rounded-full bg-muted"
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative mt-0.5 size-5 shrink-0 rounded-full border-[5px]",
                    index === 0 ? "border-blue-500 bg-background" : "border-muted bg-background",
                  )}
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-medium tracking-tight">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <h2 className="text-lg font-semibold tracking-tight shrink-0">{children}</h2>
      <div className="h-px w-full bg-muted" />
    </div>
  );
}

/** Both apps, the price and the free places as rows on a departure board, like the station pages. */
function BetaBoard() {
  return (
    <div className="overflow-hidden rounded-4xl bg-card shadow-md ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground md:px-5">
        <span>Departures</span>
        <span>Mobile app</span>
      </div>
      <ul className="divide-y divide-border border-y border-border">
        <BoardRow
          accent="blue"
          badge={<img src="/icon.svg" alt="" width={48} height={48} className="size-12" />}
          title="Android beta"
          subtitle="To Google Play"
          time="Now"
        />
        <BoardRow
          badge={<BellIcon className="size-5 text-muted-foreground" />}
          title="iPhone app"
          subtitle="To the App Store"
          time={<span className="text-muted-foreground">Soon</span>}
          status={<span className="text-muted-foreground">Waitlist</span>}
        />
        <BoardRow
          badge={<TicketIcon className="size-5 text-muted-foreground" />}
          title="App price"
          subtitle="One-time purchase"
          time={APP_PRICE}
          status={<span className="text-muted-foreground">plus VAT</span>}
        />
        <BoardRow
          accent="green"
          badge={<GiftIcon className="size-5 text-muted-foreground" />}
          title="Free beta access"
          subtitle={`Limited to ${FREE_BETA_PLACES} Android testers`}
          time={
            <>
              <s className="font-normal text-muted-foreground decoration-1">{APP_PRICE}</s>{" "}
              <span className="text-green-600 dark:text-green-400">Free</span>
            </>
          }
          status={<span className="text-muted-foreground">Code with invite</span>}
        />
      </ul>
      <p className="m-3 flex items-center gap-2.5 rounded-3xl bg-muted/50 px-3.5 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:mx-4">
        <MegaphoneIcon className="size-4 shrink-0" />
        The website stays free for everyone
      </p>
    </div>
  );
}

function BoardRow({
  accent,
  badge,
  title,
  subtitle,
  time,
  status,
}: {
  accent?: "blue" | "green";
  badge: ReactNode;
  title: string;
  subtitle: string;
  time: ReactNode;
  status?: ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-l-3 py-3.5 pr-4 pl-[13px] md:pr-5 md:pl-[17px]",
        accent === "blue" && "border-l-blue-500",
        accent === "green" && "border-l-green-500",
        !accent && "border-l-transparent",
      )}
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
        {badge}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-base font-medium tracking-tight">{title}</span>
          <span className="shrink-0 text-base font-medium tabular-nums">{time}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-muted-foreground">{subtitle}</span>
          {status && <span className="shrink-0 text-xs">{status}</span>}
        </div>
      </div>
    </li>
  );
}

/** Both appearances of a screenshot stacked, so switching between them doesn't wait for a load. */
function Screenshot({
  name,
  alt,
  appearance,
}: {
  name: string;
  alt: string;
  appearance: Appearance;
}) {
  return (
    <div className="grid overflow-hidden rounded-[1.75rem] shadow-xl ring-1 ring-foreground/15">
      {(["dark", "light"] as const).map((mode) => (
        <img
          key={mode}
          src={`/assets/screenshots/app-${name}-${mode}.webp`}
          alt={mode === appearance ? alt : ""}
          aria-hidden={mode !== appearance}
          width={600}
          height={1334}
          loading="lazy"
          decoding="async"
          className={cn(
            "col-start-1 row-start-1 block h-auto w-full transition-opacity duration-200 ease-out motion-reduce:transition-none",
            mode !== appearance && "opacity-0",
          )}
        />
      ))}
    </div>
  );
}

type SignupStatus = "idle" | "joining" | "joined" | "rate-limited" | "failed" | "offline";

function getSignupError(status: SignupStatus, platform: AppPlatform | null) {
  const list = platform === "ios" ? "the waitlist" : "the beta";
  switch (status) {
    case "rate-limited":
      return "Too many signups from this network. Wait a minute and try again.";
    case "failed":
      return `Couldn't join ${list}. Try again in a few minutes.`;
    case "offline":
      return `Couldn't join ${list}. Check your connection and try again.`;
    default:
      return undefined;
  }
}

function SignupCard({
  platform,
  onPlatformChange,
}: {
  platform: AppPlatform | null;
  onPlatformChange: (platform: AppPlatform) => void;
}) {
  const isIos = platform === "ios";
  const isAndroid = platform === "android";
  const actionLabel = isIos ? "Notify me" : isAndroid ? "Join the beta" : "Sign up";
  const placeholder = isAndroid ? "name@gmail.com" : "name@example.com";
  const platformLabelId = useId();
  const inputId = useId();
  const hintId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const platformRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SignupStatus>("idle");
  const [invalid, setInvalid] = useState(false);
  const [platformMissing, setPlatformMissing] = useState(false);
  const [scrolledPast, setScrolledPast] = useState(false);

  const trimmed = email.trim();
  const domain = trimmed.split("@")[1]?.toLowerCase() ?? "";
  const isOtherDomain = domain.includes(".") && !GOOGLE_MAIL_DOMAINS.has(domain);
  const signupError = getSignupError(status, platform);

  // Offer a shortcut back to the form once it scrolls off the top of the screen.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setScrolledPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!platform) {
      setPlatformMissing(true);
      platformRef.current?.querySelector("button")?.focus();
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setInvalid(true);
      return;
    }
    setStatus("joining");
    try {
      const signup = platform === "ios" ? joinIphoneWaitlist : joinBeta;
      const { status } = await signup({ data: { email: trimmed } });
      if (status === "invalid") {
        setInvalid(true);
        setStatus("idle");
      } else {
        setStatus(status);
      }
    } catch {
      setStatus("offline");
    }
  };

  const returnToForm = () => {
    // Focus first, inside the tap, so mobile browsers open the keyboard.
    inputRef.current?.focus({ preventScroll: true });
    containerRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
  };

  const hint = platformMissing
    ? { tone: "error", text: "Choose Android or iPhone, so we know what to send you." }
    : invalid
      ? { tone: "error", text: `Enter an email address, like ${placeholder}.` }
      : signupError
        ? { tone: "error", text: signupError }
        : isIos
          ? { tone: "muted", text: "We only email you about the iPhone app and its launch." }
          : !isAndroid
            ? { tone: "muted", text: "Pick the phone you'll install Rail Radar on." }
            : isOtherDomain
              ? {
                  tone: "muted",
                  text: "Not Gmail? That's fine if it's the account on your Play Store.",
                }
              : {
                  tone: "muted",
                  text: "Use your Play Store account. We only email you about the beta and the launch.",
                };

  return (
    <LazyMotion features={domAnimation}>
      <div ref={containerRef} className="scroll-mt-6">
        <AnimatePresence mode="wait" initial={false}>
          {status === "joined" ? (
            <BoardingPass
              key="pass"
              email={trimmed}
              platform={isIos ? "ios" : "android"}
              onReset={() => {
                setEmail("");
                setStatus("idle");
              }}
            />
          ) : (
            <m.div
              key="form"
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.15, ease: "easeIn" }}
            >
              <Card>
                <CardContent>
                  <form noValidate onSubmit={handleSubmit}>
                    <p id={platformLabelId} className="text-sm font-medium">
                      Which phone do you use?
                    </p>
                    <ToggleGroup
                      ref={platformRef}
                      value={platform ? [platform] : []}
                      onValueChange={(value) => {
                        const selected = value[0];
                        if (selected !== "android" && selected !== "ios") return;
                        onPlatformChange(selected);
                        setPlatformMissing(false);
                        if (signupError) setStatus("idle");
                      }}
                      variant="outline"
                      disabled={status === "joining"}
                      aria-labelledby={platformLabelId}
                      aria-describedby={platformMissing ? hintId : undefined}
                      className="mt-2 mb-5 w-full"
                    >
                      {(["android", "ios"] as const).map((value) => (
                        <ToggleGroupItem
                          key={value}
                          value={value}
                          aria-invalid={platformMissing || undefined}
                          className="h-11 flex-1 shrink text-base aria-pressed:border-blue-500 aria-pressed:bg-blue-500/10 sm:text-sm"
                        >
                          {value === "ios" ? "iPhone" : "Android"}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <label htmlFor={inputId} className="text-sm font-medium">
                      {isAndroid ? "Google account email" : "Email address"}
                    </label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <Input
                        ref={inputRef}
                        id={inputId}
                        type="email"
                        name="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="send"
                        placeholder={placeholder}
                        value={email}
                        disabled={status === "joining"}
                        aria-invalid={invalid || undefined}
                        aria-describedby={hintId}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setInvalid(false);
                          if (signupError) setStatus("idle");
                        }}
                        className="h-12 px-4 text-base md:text-base sm:flex-1"
                      />
                      <Button
                        type="submit"
                        size="lg"
                        disabled={status === "joining"}
                        className="h-12 px-5 text-base sm:text-sm"
                      >
                        {status === "joining" ? (
                          <>
                            <Spinner aria-hidden="true" role={undefined} />
                            Joining…
                          </>
                        ) : (
                          actionLabel
                        )}
                      </Button>
                    </div>
                    <p
                      id={hintId}
                      aria-live="polite"
                      className={cn(
                        "mt-3 text-sm leading-6 text-pretty",
                        hint.tone === "error" ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {hint.text}
                    </p>
                    <p className="mt-3 flex gap-2.5 border-t border-border pt-3 text-sm leading-6 text-pretty">
                      <CheckIcon className="mt-1 size-4 shrink-0 text-green-600 dark:text-green-400" />
                      <span>
                        {isIos ? (
                          "Joining the waitlist is free."
                        ) : !isAndroid ? (
                          "Signing up is free. The website stays free for everyone."
                        ) : (
                          <>
                            <strong className="font-medium">
                              The app is free for {FREE_BETA_PLACES} beta testers.
                            </strong>{" "}
                            If you receive a free place, your invite will include a Google Play
                            promo code. Otherwise, the app costs {APP_PRICE} plus VAT. Signing up is
                            free.
                          </>
                        )}
                      </span>
                    </p>
                  </form>
                </CardContent>
              </Card>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {scrolledPast && status !== "joined" && (
          <m.div
            key="sticky-join"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 sm:hidden"
          >
            <Button
              size="lg"
              onClick={returnToForm}
              className="h-12 w-full text-base shadow-lg shadow-black/40"
            >
              {actionLabel}
            </Button>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}

/** The joined state: a ticket that prints in from the top, with the email as the passenger. */
function BoardingPass({
  email,
  platform,
  onReset,
}: {
  email: string;
  platform: AppPlatform;
  onReset: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const isIos = platform === "ios";

  return (
    <m.div
      role="status"
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, y: -12, clipPath: "inset(0% 0% 100% 0% round 2rem)" }
      }
      animate={
        reduceMotion
          ? { opacity: 1 }
          : { opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0% round 2rem)" }
      }
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-4xl bg-card shadow-md ring-1 ring-foreground/10"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <img src="/icon.svg" alt="" width={20} height={20} className="size-5" />
          Rail Radar
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Boarding pass
        </span>
      </div>

      <div className="px-5 pt-5 pb-6">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              From
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">Web</p>
          </div>
          <div aria-hidden="true" className="mb-2.5 flex flex-1 items-center gap-1.5">
            <span className="h-px flex-1 border-t border-dashed border-muted-foreground/40" />
            <TrainFrontIcon className="size-4 text-blue-600 dark:text-blue-400" />
            <span className="h-px flex-1 border-t border-dashed border-muted-foreground/40" />
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              To
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {isIos ? "iPhone" : "Google Play"}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          <div className="col-span-2 min-w-0">
            <dt className="text-xs text-muted-foreground">Passenger</dt>
            <dd className="mt-0.5 font-medium break-all">{email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Class</dt>
            <dd className="mt-0.5 font-medium">{isIos ? "iPhone waitlist" : "Beta tester"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Boarding</dt>
            <dd className="mt-0.5 font-medium">{isIos ? "When it's ready" : "By email invite"}</dd>
          </div>
        </dl>
      </div>

      <div aria-hidden="true" className="relative h-0">
        <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-background ring-1 ring-foreground/10" />
        <span className="absolute inset-x-5 top-0 border-t-2 border-dashed border-border" />
        <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-background ring-1 ring-foreground/10" />
      </div>

      <div className="px-5 pt-6 pb-5">
        <h2 className="text-lg font-semibold tracking-tight">
          {isIos ? "You're on the iPhone waitlist." : "You joined the beta."}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">
          {isIos
            ? "We'll email you as soon as the iPhone app is ready to try."
            : "We'll email your invite once we add you to the test. Installing the beta is up to you, and you can wait for the public release instead."}
        </p>
        <Button variant="outline" className="mt-4 w-full sm:w-auto" onClick={onReset}>
          Use a different email
        </Button>
      </div>
    </m.div>
  );
}

type CheckState = "pass" | "fail" | "unknown";

interface Requirement {
  title: string;
  detail: string;
  state: CheckState;
}

function getRequirements(device: DeviceCheck): Requirement[] {
  const phone: Requirement =
    device.platform === "android"
      ? { title: "An Android phone", detail: "You're on one right now.", state: "pass" }
      : device.platform === "ios"
        ? {
            title: "An Android phone",
            detail: "This beta is for Android only, so it won't install on an iPhone.",
            state: "fail",
          }
        : {
            title: "An Android phone",
            detail: "You can sign up from here and install the app on your phone later.",
            state: "unknown",
          };

  const { androidVersion } = device;
  const version: Requirement =
    androidVersion === null
      ? {
          title: `Android ${MIN_ANDROID_VERSION} or later`,
          detail: "You can check yours in Settings, under About phone.",
          state: "unknown",
        }
      : androidVersion >= MIN_ANDROID_VERSION
        ? {
            title: `Android ${MIN_ANDROID_VERSION} or later`,
            detail: `Your phone runs Android ${androidVersion}.`,
            state: "pass",
          }
        : {
            title: `Android ${MIN_ANDROID_VERSION} or later`,
            detail: `Your phone runs Android ${androidVersion}, so Google Play won't install the app on it.`,
            state: "fail",
          };

  return [
    phone,
    version,
    {
      title: "A Google account on the Play Store",
      detail: "The invite goes to its email, and only that account can join the test.",
      state: "unknown",
    },
  ];
}

function Requirements() {
  const device = useDeviceCheck();
  const requirements = getRequirements(device);

  return (
    <Card size="sm" className="py-0">
      <ul className="divide-y divide-border">
        {requirements.map((requirement) => (
          <li key={requirement.title} className="flex items-start gap-3 px-4 py-3.5">
            <RequirementStatus
              state={requirement.state}
              checking={device.platform === "checking"}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium tracking-tight">{requirement.title}</p>
              <p className="mt-0.5 text-sm leading-6 text-muted-foreground text-pretty">
                {requirement.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RequirementStatus({ state, checking }: { state: CheckState; checking: boolean }) {
  const label = checking
    ? "Checking"
    : state === "pass"
      ? "Met"
      : state === "fail"
        ? "Not met"
        : "Check yourself";

  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
        state === "pass" && "bg-green-500/15 text-green-600 dark:text-green-400",
        state === "fail" && "bg-red-500/15 text-red-600 dark:text-red-400",
        state === "unknown" && "text-muted-foreground",
      )}
    >
      {state === "pass" ? (
        <CheckIcon className="size-3" />
      ) : state === "fail" ? (
        <XIcon className="size-3" />
      ) : (
        <CircleDashedIcon
          className={cn("size-5", checking && "animate-spin [animation-duration:3s]")}
        />
      )}
    </span>
  );
}
