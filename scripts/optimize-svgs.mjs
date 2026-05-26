#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { optimize } from "svgo";

const repoRoot = path.resolve(import.meta.dirname, "..");
const defaultTarget = "apps/static/public/operators";
const maxListedFiles = 20;

const args = process.argv.slice(2);
const options = {
  backgroundColor: "#fff",
  check: false,
  forceBackground: false,
  multipass: false,
  targets: [],
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === "--check") {
    options.check = true;
    continue;
  }

  if (arg === "--force-background") {
    options.forceBackground = true;
    continue;
  }

  if (arg === "--multipass") {
    options.multipass = true;
    continue;
  }

  if (arg === "--background") {
    const value = args[index + 1];
    if (!value) {
      throw new Error("--background requires a color value");
    }

    options.backgroundColor = value;
    index += 1;
    continue;
  }

  if (arg.startsWith("--background=")) {
    options.backgroundColor = arg.slice("--background=".length);
    continue;
  }

  if (arg.startsWith("-")) {
    throw new Error(`Unknown option: ${arg}`);
  }

  options.targets.push(arg);
}

if (options.targets.length === 0) {
  options.targets.push(defaultTarget);
}

const files = (
  await Promise.all(options.targets.map((target) => findSvgFiles(path.resolve(repoRoot, target))))
).flat();

let changed = 0;
let beforeBytes = 0;
let afterBytes = 0;
const changedFiles = [];

for (const file of files) {
  const input = await readFile(file, "utf8");
  beforeBytes += Buffer.byteLength(input);

  const optimized = optimize(input, {
    path: file,
    multipass: options.multipass,
    plugins: ["preset-default", "removeDimensions", "sortAttrs"],
  });

  if ("error" in optimized) {
    throw new Error(`${path.relative(repoRoot, file)}: ${optimized.error}`);
  }

  const output = ensureSvgBackground(
    optimized.data.trim(),
    options.backgroundColor,
    options.forceBackground,
  );

  afterBytes += Buffer.byteLength(output);

  if (output === input) {
    continue;
  }

  changed += 1;
  changedFiles.push(path.relative(repoRoot, file));

  if (!options.check) {
    await writeFile(file, output);
  }
}

const byteDelta = afterBytes - beforeBytes;
const sign = byteDelta > 0 ? "+" : "";
const mode = options.check ? "would change" : "changed";

console.log(
  `${mode} ${changed}/${files.length} SVGs (${formatBytes(beforeBytes)} -> ${formatBytes(afterBytes)}, ${sign}${formatBytes(byteDelta)})`,
);

if (changedFiles.length > 0) {
  const listedFiles = changedFiles.slice(0, maxListedFiles);
  console.log(listedFiles.map((file) => `- ${file}`).join("\n"));

  if (changedFiles.length > maxListedFiles) {
    console.log(`- …and ${changedFiles.length - maxListedFiles} more`);
  }
}

if (options.check && changed > 0) {
  process.exitCode = 1;
}

async function findSvgFiles(target) {
  const targetStat = await stat(target);

  if (targetStat.isFile()) {
    if (target.endsWith(".svg")) {
      return [target];
    }

    return [];
  }

  if (!targetStat.isDirectory()) {
    return [];
  }

  const entries = await readdir(target, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => findSvgFiles(path.join(target, entry.name))),
  );

  return nested.flat().sort();
}

function ensureSvgBackground(svg, backgroundColor, forceBackground) {
  return svg.replace(/<svg\b([^>]*)>/i, (match, rawAttributes) => {
    const styleMatch = rawAttributes.match(/\sstyle=(["'])(.*?)\1/is);

    if (!styleMatch) {
      return `<svg style="background-color:${backgroundColor}"${rawAttributes}>`;
    }

    const quote = styleMatch[1];
    const style = styleMatch[2];
    const hasBackground = /(^|;)\s*background(?:-color)?\s*:/i.test(style);

    if (hasBackground && !forceBackground) {
      return match;
    }

    const nextStyle = hasBackground
      ? style.replace(
          /(^|;)\s*background(?:-color)?\s*:[^;]*/i,
          `$1background-color:${backgroundColor}`,
        )
      : `background-color:${backgroundColor};${style}`;

    return match.replace(styleMatch[0], ` style=${quote}${nextStyle}${quote}`);
  });
}

function formatBytes(bytes) {
  const absoluteBytes = Math.abs(bytes);

  if (absoluteBytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KiB`;
}
