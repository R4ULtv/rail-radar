import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const mobileDir = new URL("../", import.meta.url);
const repoRoot = fileURLToPath(new URL("../../", mobileDir));
const releasePaths = [
  "apps/mobile/app.json",
  "apps/mobile/package.json",
  "apps/mobile/CHANGELOG.md",
];
const files = {
  app: new URL("app.json", mobileDir),
  package: new URL("package.json", mobileDir),
  changelog: new URL("CHANGELOG.md", mobileDir),
  android: new URL("android/app/build.gradle", mobileDir),
  ios: new URL("ios/RailRadar.xcodeproj/project.pbxproj", mobileDir),
  iosInfo: new URL("ios/RailRadar/Info.plist", mobileDir),
};

function replace(source, pattern, value, label, expectedCount = 1) {
  const countingPattern = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  const count = [...source.matchAll(countingPattern)].length;
  if (count !== expectedCount)
    throw new Error(`Expected ${expectedCount} ${label} field(s), found ${count}`);
  return source.replace(pattern, value);
}

async function readOptional(url) {
  try {
    return await readFile(url, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function parseVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid version: ${version}`);
  const parts = version.split(".").map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part)))
    throw new Error(`Invalid version: ${version}`);
  return parts;
}

function nextVersion(current, requested) {
  const [major, minor, patch] = parseVersion(current);
  if (requested === "major") return `${major + 1}.0.0`;
  if (requested === "minor") return `${major}.${minor + 1}.0`;
  if (requested === "patch") return `${major}.${minor}.${patch + 1}`;
  const next = parseVersion(requested);
  if (next.every((part, index) => part === [major, minor, patch][index])) {
    throw new Error(`Version ${requested} is already current`);
  }
  for (const [index, part] of next.entries()) {
    if (part > [major, minor, patch][index]) return requested;
    if (part < [major, minor, patch][index]) break;
  }
  throw new Error(`Version ${requested} must be newer than ${current}`);
}

function updatePlistValue(source, key, value, reference, label) {
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]+)(</string>)`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Generated iOS Info.plist is missing ${key}`);
  if (match[2] === reference) return source;
  if (!/^\d+(?:\.\d+)*$/.test(match[2])) {
    throw new Error(`Unexpected ${key} value in generated iOS Info.plist: ${match[2]}`);
  }
  return replace(source, pattern, `$1${value}$3`, label);
}

function git(...args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    throw new Error(`git ${args[0]} failed: ${error.stderr?.trim() || error.message}`);
  }
}

function checkTagReady(version) {
  const tag = `mobile-v${version}`;
  if (git("diff", "--cached", "--name-only")) {
    throw new Error("Commit or unstage existing staged changes before creating a release tag");
  }
  if (git("tag", "--list", tag)) throw new Error(`Tag ${tag} already exists locally`);
  git("var", "GIT_AUTHOR_IDENT");
  git("var", "GIT_COMMITTER_IDENT");
  return tag;
}

function tagRelease(version, build, tag) {
  if (git("diff", "--name-only", "HEAD", "--", ...releasePaths)) {
    git("add", "--", ...releasePaths);
    git("commit", "-m", `chore(mobile): release ${version} (${build})`, "--", ...releasePaths);
  }
  const committed = JSON.parse(git("show", "HEAD:apps/mobile/app.json")).expo;
  if (committed.version !== version || committed.android.versionCode !== build) {
    throw new Error("HEAD does not contain the requested mobile version; tag was not created");
  }
  git("tag", "-a", tag, "-m", `Mobile ${version} (${build})`);
  console.log(`Created tag ${tag} on ${git("rev-parse", "--short", "HEAD")}`);
}

const args = process.argv.slice(2);
const tagCurrent = args.includes("--tag-current");
const tag = args.includes("--tag") || tagCurrent;
const positional = args.filter((arg) => !["--tag", "--tag-current"].includes(arg));
const [requested = "patch", requestedBuild, ...extra] = positional;
if (args.includes("--help")) {
  console.log(
    "Usage: node scripts/bump-version.mjs [patch|minor|major|x.y.z] [build-number] [--tag]",
  );
  console.log("       node scripts/bump-version.mjs --tag-current");
  process.exit(0);
}
if (extra.length || (tagCurrent && positional.length)) {
  throw new Error("Invalid arguments; run with --help for usage");
}

const appSource = await readFile(files.app, "utf8");
const packageSource = await readFile(files.package, "utf8");
const changelogSource = await readFile(files.changelog, "utf8");
const app = JSON.parse(appSource);
const currentVersion = app.expo.version;
const currentBuild = app.expo.android.versionCode;
if (!Number.isSafeInteger(currentBuild) || currentBuild < 1) {
  throw new Error("app.json must have a positive android.versionCode");
}
if (app.expo.ios.buildNumber !== String(currentBuild)) {
  throw new Error("app.json ios.buildNumber must match android.versionCode");
}

if (tagCurrent) {
  if (!changelogSource.includes(`## [${currentVersion}] (${currentBuild})`)) {
    throw new Error(`CHANGELOG.md is missing release ${currentVersion} (${currentBuild})`);
  }
  tagRelease(currentVersion, currentBuild, checkTagReady(currentVersion));
  process.exit(0);
}

const version = nextVersion(currentVersion, requested);
const build =
  requestedBuild === undefined
    ? currentBuild + 1
    : /^\d+$/.test(requestedBuild)
      ? Number(requestedBuild)
      : NaN;
if (!Number.isSafeInteger(build) || build <= currentBuild) {
  throw new Error(`Build number must be an integer greater than ${currentBuild}`);
}
if (!changelogSource.includes(`## [${currentVersion}] (${currentBuild})`)) {
  throw new Error(
    `CHANGELOG.md is missing the current release ${currentVersion} (${currentBuild})`,
  );
}
if (changelogSource.includes(`## [${version}]`)) {
  throw new Error(`CHANGELOG.md already has a ${version} release`);
}
const tagName = tag ? checkTagReady(version) : null;

const updates = new Map();
let appUpdated = replace(
  appSource,
  /(^\s*"version": ")\d+\.\d+\.\d+("[,]?$)/m,
  `$1${version}$2`,
  "app version",
);
appUpdated = replace(
  appUpdated,
  /(^\s*"buildNumber": ")\d+("[,]?$)/m,
  `$1${build}$2`,
  "iOS build number",
);
appUpdated = replace(
  appUpdated,
  /(^\s*"versionCode": )\d+([,]?$)/m,
  `$1${build}$2`,
  "Android version code",
);
updates.set(files.app, appUpdated);

const packageUpdated = replace(
  packageSource,
  /(^\s*"version": ")\d+\.\d+\.\d+("[,]?$)/m,
  `$1${version}$2`,
  "package version",
);
updates.set(files.package, packageUpdated);

const releaseDate = new Date();
const date = [
  releaseDate.getFullYear(),
  String(releaseDate.getMonth() + 1).padStart(2, "0"),
  String(releaseDate.getDate()).padStart(2, "0"),
].join("-");
const unreleased = /(^## \[Unreleased\]\r?\n)([\s\S]*?)(?=^## \[)/m;
const changelogUpdated = replace(
  changelogSource,
  unreleased,
  (_, heading, content) => {
    const notes = content.trim();
    return `${heading}\n## [${version}] (${build}) – ${date}\n${notes ? `\n${notes}\n` : ""}\n`;
  },
  "Unreleased changelog section",
);
updates.set(files.changelog, changelogUpdated);

const androidSource = await readOptional(files.android);
if (androidSource !== null) {
  let androidUpdated = replace(
    androidSource,
    /(^\s*versionCode\s+)\d+(\s*$)/m,
    `$1${build}$2`,
    "generated Android version code",
  );
  androidUpdated = replace(
    androidUpdated,
    /(^\s*versionName\s+")\d+\.\d+\.\d+("\s*$)/m,
    `$1${version}$2`,
    "generated Android version name",
  );
  updates.set(files.android, androidUpdated);
}

const iosSource = await readOptional(files.ios);
if (iosSource !== null) {
  const projectVersions = [...iosSource.matchAll(/\bCURRENT_PROJECT_VERSION = [^;]+;/g)].length;
  const marketingVersions = [...iosSource.matchAll(/\bMARKETING_VERSION = [^;]+;/g)].length;
  let iosUpdated = replace(
    iosSource,
    /\bCURRENT_PROJECT_VERSION = [^;]+;/g,
    `CURRENT_PROJECT_VERSION = ${build};`,
    "generated iOS build number",
    projectVersions,
  );
  iosUpdated = replace(
    iosUpdated,
    /\bMARKETING_VERSION = [^;]+;/g,
    `MARKETING_VERSION = ${version};`,
    "generated iOS version",
    marketingVersions,
  );
  if (!projectVersions || !marketingVersions)
    throw new Error("Generated iOS project is missing version fields");
  updates.set(files.ios, iosUpdated);
}

const iosInfoSource = await readOptional(files.iosInfo);
if (iosInfoSource !== null) {
  let iosInfoUpdated = updatePlistValue(
    iosInfoSource,
    "CFBundleShortVersionString",
    version,
    "$(MARKETING_VERSION)",
    "generated iOS Info.plist version",
  );
  iosInfoUpdated = updatePlistValue(
    iosInfoUpdated,
    "CFBundleVersion",
    build,
    "$(CURRENT_PROJECT_VERSION)",
    "generated iOS Info.plist build number",
  );
  updates.set(files.iosInfo, iosInfoUpdated);
}

for (const [url, content] of updates) await writeFile(url, content);
console.log(`Mobile version bumped to ${version} (${build})`);
for (const url of updates.keys()) console.log(`  ${url.pathname.replace(mobileDir.pathname, "")}`);
if (tagName) tagRelease(version, build, tagName);
