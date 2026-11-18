import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { NEW_RAIL_DATA, NEW_RAIL_DATA_DAYS, type CountryCode } from "@repo/data/countries";
import { PROVIDERS } from "@repo/data/providers";
import { App } from "../src/app";
import { latencyFixture, summaryFixture } from "./fixtures";

vi.mock("../src/latency-chart", () => ({
  default: ({ name }: { name: string }) => <div role="img" aria-label={`${name} latency chart`} />,
}));

let client: QueryClient;
let failedPaths: string[];
let wrongApiResponse: boolean;
let editSummary: ((summary: ReturnType<typeof summaryFixture>) => void) | undefined;

beforeEach(() => {
  failedPaths = [];
  wrongApiResponse = false;
  editSummary = undefined;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (failedPaths.includes(url.pathname)) return new Response("Unavailable", { status: 503 });
      if (url.pathname === "/")
        return new Response(
          wrongApiResponse ? "<html>Wrong origin</html>" : "Rail Radar API\nVersion: 1.0.0",
        );
      if (url.pathname.endsWith("/summary")) {
        const data = summaryFixture();
        editSummary?.(data);
        return Response.json(data);
      }
      if (url.pathname.endsWith("/latency")) {
        return Response.json(latencyFixture());
      }
      throw new Error(`Unexpected request ${url.pathname}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  client.clear();
});

function mount() {
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("live status dashboard", () => {
  it("shows only the API's current status and response time, without an expandable report", async () => {
    mount();
    const service = within(screen.getByRole("region", { name: "Rail Radar API" }));
    expect(await service.findByText("Responding")).toBeDefined();
    expect(service.getByText("Response time")).toBeDefined();
    expect(service.getByText(/Response time includes your network connection/)).toBeDefined();
    expect(service.queryByRole("button")).toBeNull();
    expect(service.queryByRole("toolbar")).toBeNull();
    expect(service.queryByRole("img", { name: "Rail Radar API latency chart" })).toBeNull();
    expect(service.queryByText("Server success rate")).toBeNull();
  });

  it("keeps provider and country identity readable when shared artwork is unavailable", async () => {
    mount();
    const rfi = await screen.findByRole("button", { name: /^RFI.*Operational/ });
    const logo = rfi.querySelector<HTMLImageElement>(".provider-logo img")!;
    const flag = rfi.querySelector<HTMLImageElement>(".provider-country img")!;
    expect(logo.getAttribute("src")).toBe("/__shared-assets/providers/rfi.svg");
    expect(flag.getAttribute("src")).toBe("/__shared-assets/flags/it.svg");
    fireEvent.error(logo);
    fireEvent.error(flag);
    expect(rfi.querySelector(".provider-logo img")).toBeNull();
    expect(rfi.querySelector(".provider-logo svg")).not.toBeNull();
    expect(flag.hidden).toBe(true);
    expect(rfi.textContent).toContain("RFI");
    expect(rfi.textContent).toContain("Italy");
    fireEvent.click(rfi);
    await screen.findByText("About RFI");
  });

  it("shows all providers and expands a provider's history and chart on demand", async () => {
    mount();
    const rfi = await screen.findByRole("button", { name: /^RFI.*Operational/ });
    expect(screen.queryByText("About RFI")).toBeNull();
    expect(screen.queryByRole("img", { name: "RFI latency chart" })).toBeNull();
    expect(screen.getByRole("button", { name: /^MÁV/ })).toBeDefined();
    fireEvent.click(rfi);
    await screen.findByText("About RFI");
    expect(await screen.findByRole("img", { name: "RFI latency chart" })).toBeDefined();
    expect(
      screen.getByRole("toolbar", { name: /^RFI: daily status/ }).querySelectorAll("button"),
    ).toHaveLength(30);
    expect(rfi.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: /RFI website/ }).getAttribute("href")).toBe(
      "https://www.rfi.it",
    );
    expect(screen.queryByText("Known issue")).toBeNull();
    const stations = screen.getByRole("link", { name: /Stations in Italy/ });
    expect(stations.getAttribute("href")).toMatch(/\/stations\/italy$/);
    expect(rfi.getAttribute("aria-label")).toBe("RFI, Italy: Operational");
    expect(rfi.textContent).toContain("last hour");
    expect(screen.getByText("Success rate · last hour")).toBeDefined();
    expect(screen.getByRole("region", { name: "RFI, Italy: Operational" })).toBeDefined();
    fireEvent.click(rfi);
    await waitFor(() => expect(screen.queryByText("About RFI")).toBeNull());
  });

  it("flags providers with a known data issue and explains it when expanded", async () => {
    mount();
    const sncf = await screen.findByRole("button", {
      name: "SNCF, France: Degraded, known issue",
    });
    fireEvent.click(sncf);
    expect(await screen.findByText("Known issue")).toBeDefined();
    expect(screen.getByText(/Platform and origin information may be missing/)).toBeDefined();
  });

  describe("new data source flag", () => {
    const [listed] = Object.entries(NEW_RAIL_DATA) as [CountryCode, string][];
    const provider = listed && PROVIDERS.find((item) => item.country === listed[0]);
    const start = listed ? Date.parse(`${listed[1]}T00:00:00Z`) : 0;
    afterEach(() => vi.useRealTimers());

    it.skipIf(!provider)("flags a newly added provider and explains it when expanded", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(start + 86_400_000);
      mount();
      const row = await screen.findByRole("button", {
        name: new RegExp(`^${provider!.name},.*new data source`),
      });
      fireEvent.click(row);
      expect(await screen.findByText("New data source")).toBeDefined();
    });

    it.skipIf(!provider)("drops the flag once it lapses", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(start + NEW_RAIL_DATA_DAYS * 86_400_000);
      mount();
      await waitFor(() =>
        expect(
          screen
            .getByRole("button", { name: new RegExp(`^${provider!.name},`) })
            .getAttribute("aria-label"),
        ).not.toContain("new data source"),
      );
    });
  });

  describe("network headline", () => {
    const healthyExcept = (unknown: string[]) => (summary: ReturnType<typeof summaryFixture>) => {
      for (const provider of summary.providers) {
        Object.assign(provider, { errors: 0, successes: provider.requests, successRate: 1 });
        provider.status = unknown.includes(provider.id) ? "unknown" : "operational";
      }
      summary.counts = {
        operational: summary.providers.length - unknown.length,
        degraded: 0,
        outage: 0,
        unknown: unknown.length,
      };
    };

    it("gives an all-clear when the only gaps are providers with too little traffic", async () => {
      editSummary = healthyExcept(["digitraffic", "mobiliteit"]);
      mount();
      expect(
        await screen.findByText(
          "All observed providers are healthy · 2 with too little recent traffic",
        ),
      ).toBeDefined();
    });

    it("omits the traffic note when every provider has enough observations", async () => {
      editSummary = healthyExcept([]);
      mount();
      expect(await screen.findByText("All observed providers are healthy")).toBeDefined();
    });

    it("keeps reporting failures over the all-clear", async () => {
      mount();
      expect(await screen.findByText("1 provider had elevated failures")).toBeDefined();
    });

    it("waits when no provider has enough observations yet", async () => {
      editSummary = (summary) =>
        healthyExcept(summary.providers.map((provider) => provider.id))(summary);
      mount();
      expect(await screen.findByText("Waiting for more observations")).toBeDefined();
    });
  });

  it("splits a provider's traffic into visitor requests and scheduled checks", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /^RFI.*Operational/ }));
    const sources = within(await screen.findByRole("region", { name: "RFI traffic sources" }));
    expect(sources.getByText("last hour")).toBeDefined();
    const visitors = sources.getByText("Visitor requests").closest("div")!;
    const checks = sources.getByText("Scheduled checks").closest("div")!;
    expect(visitors.textContent).toContain("990.0%");
    expect(checks.textContent).toContain("110.0%");
    expect(checks.textContent).toContain("100.0% successful");
  });

  it("stripes days observed only through scheduled checks and explains them", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /^RFI.*Operational/ }));
    const bars = (
      await screen.findByRole("toolbar", { name: /^RFI: daily status/ })
    ).querySelectorAll("button");
    expect(bars[27]!.hasAttribute("data-checks-only")).toBe(true);
    expect(bars[27]!.getAttribute("aria-label")).toContain("(0 from visitors, 10 checks)");
    expect(bars[26]!.hasAttribute("data-checks-only")).toBe(false);
    expect(bars[26]!.getAttribute("aria-label")).toContain("(8 from visitors, 2 checks)");
    expect(screen.getByText("Scheduled checks only")).toBeDefined();
  });

  it("marks today's bar as a partial day", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /^RFI.*Operational/ }));
    const bars = (
      await screen.findByRole("toolbar", { name: /^RFI: daily status/ })
    ).querySelectorAll("button");
    expect(bars[bars.length - 1]!.hasAttribute("data-partial")).toBe(true);
    expect(bars[0]!.hasAttribute("data-partial")).toBe(false);
  });

  it("lets touch select a day anywhere along the daily status strip", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /^RFI.*Operational/ }));
    const strip = await screen.findByRole("toolbar", { name: /^RFI: daily status/ });
    strip.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
    fireEvent.pointerDown(strip, { pointerType: "touch", clientX: 5, buttons: 1 });
    const first = strip.querySelectorAll("button")[0]!;
    expect(first.getAttribute("aria-pressed")).toBe("true");
    fireEvent.pointerMove(strip, { pointerType: "touch", clientX: 299, buttons: 1 });
    const buttons = strip.querySelectorAll("button");
    expect(buttons[buttons.length - 1]!.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("so far today");
  });

  it("filters degraded and low-data providers while retaining their expandable details", async () => {
    mount();
    await screen.findByRole("button", { name: /^RFI.*Operational/ });
    fireEvent.click(screen.getByRole("button", { name: /Needs attention/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /^RFI,/ })).toBeNull());
    expect(screen.getByRole("button", { name: /^SNCF.*Degraded/ })).toBeDefined();
    const sparse = screen.getByRole("button", { name: /^Digitraffic.*Insufficient data/ });
    expect(sparse.textContent).toContain("last 24 hours");
    fireEvent.click(sparse);
    expect(await screen.findByText("No latency data yet")).toBeDefined();
  });

  it("keeps Rail Radar responding when analytics are unavailable", async () => {
    failedPaths = ["/status/summary", "/status/latency"];
    mount();
    await screen.findByText("Responding");
    expect(await screen.findByText("Provider health could not be refreshed")).toBeDefined();
    expect(screen.getByRole("button", { name: /^RFI.*Insufficient data/ })).toBeDefined();
    expect(screen.queryByText("API history is not available yet")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Rail Radar API/ })).toBeNull();
  });

  it("preserves current provider health when only history fails", async () => {
    failedPaths = ["/status/latency"];
    mount();
    const rfi = await screen.findByRole("button", { name: /^RFI.*Operational/ });
    fireEvent.click(rfi);
    expect(await screen.findByText("History unavailable")).toBeDefined();
    expect(screen.getByText("Provider history could not be refreshed")).toBeDefined();
  });

  it("does not report an unrelated successful HTTP page as a healthy Rail Radar API", async () => {
    wrongApiResponse = true;
    mount();
    expect(await screen.findByText("Unverified")).toBeDefined();
    expect(screen.queryByText("Responding")).toBeNull();
  });

  it("keeps provider observations when only the API-root verification fails", async () => {
    failedPaths = ["/"];
    mount();
    expect(await screen.findByText("Unverified")).toBeDefined();
    expect(await screen.findByRole("button", { name: /^RFI.*Operational/ })).toBeDefined();
    expect(screen.queryByText("Provider health could not be refreshed")).toBeNull();
  });

  it("withdraws cached healthy labels when a manual summary refresh fails", async () => {
    mount();
    await screen.findByRole("button", { name: /^RFI.*Operational/ });
    const refresh = screen.getByRole("button", { name: "Refresh" });
    await waitFor(() => expect(refresh.hasAttribute("disabled")).toBe(false));
    failedPaths = ["/status/summary"];
    fireEvent.click(refresh);
    expect(await screen.findByText("Provider health could not be refreshed")).toBeDefined();
    expect(screen.getByRole("button", { name: /^RFI.*Insufficient data/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /^RFI.*Operational/ })).toBeNull();
  });
});
