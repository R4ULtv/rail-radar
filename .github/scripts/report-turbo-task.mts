#!/usr/bin/env node

/**
 * Report one task from a finished `turbo run --summarize`, so checks that ran together in a
 * single Turbo invocation still get their own CI step and result. Prints each package's log
 * in a collapsible group, annotates failures, and exits non-zero if any package failed.
 * Run directly with Node 24: `node .github/scripts/report-turbo-task.mts <task>`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface SummaryTask {
  task: string;
  package: string;
  logFile: string;
  cache?: { status?: string };
  execution?: { exitCode?: number } | null;
}

const task = process.argv[2];
if (!task) {
  console.error("Usage: report-turbo-task.mts <task>");
  process.exit(2);
}

const runsDir = ".turbo/runs";
const summaries = existsSync(runsDir)
  ? readdirSync(runsDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => join(runsDir, name))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  : [];
if (summaries.length === 0) {
  console.log(`::error title=${task}::No Turbo run summary found; the checks did not run.`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(summaries[0]!, "utf8")) as { tasks: SummaryTask[] };
const results = summary.tasks.filter((entry) => entry.task === task);
if (results.length === 0) {
  console.log(`No affected packages have a "${task}" task.`);
  process.exit(0);
}

let failed = 0;
for (const result of results) {
  // A task Turbo never started (no execution record) counts as a failure, not a pass.
  const exitCode = result.execution?.exitCode;
  const ok = exitCode === 0;
  if (!ok) failed++;

  const cache = result.cache?.status === "HIT" ? ", cached" : "";
  console.log(`::group::${ok ? "✓" : "✗"} ${result.package}${cache}`);
  console.log(
    existsSync(result.logFile) ? readFileSync(result.logFile, "utf8") : "(no log recorded)",
  );
  console.log("::endgroup::");
  if (!ok) {
    console.log(
      `::error title=${task} failed in ${result.package}::Exit code ${exitCode ?? "none (did not run)"}`,
    );
  }
}

console.log(`${task}: ${results.length - failed}/${results.length} packages passed.`);
process.exit(failed > 0 ? 1 : 0);
