const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const trackedFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8"
})
  .split(/\r?\n/)
  .filter(Boolean);

const findings = [];

for (const file of trackedFiles) {
  if (file === ".env") {
    findings.push(`${file}: arquivo sensivel nao pode ser versionado`);
  }
}

const searchableFiles = trackedFiles.filter((file) => !/package-lock\.json$/.test(file));

for (const file of searchableFiles) {
  let content = "";
  try {
    content = fs.readFileSync(path.join(root, file), "utf8");
  } catch {
    continue;
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const location = `${file}:${index + 1}`;

    if (/\b\d{17,20}\b/.test(line)) {
      findings.push(`${location}: ID Discord fixo`);
    }

    if (file === ".env.example" && /https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(line)) {
      findings.push(`${location}: URL local em arquivo de exemplo`);
    }

    if (file === ".env.example" && /https?:\/\/(?![^/\s]+\.example\.invalid\b)/i.test(line)) {
      findings.push(`${location}: URL real em arquivo de exemplo`);
    }

    if (file === ".env.example" && /(?:postgres|mongodb|mysql|redis):\/\/(?!.*example)/i.test(line)) {
      findings.push(`${location}: Database URL real em arquivo de exemplo`);
    }
  });
}

if (findings.length) {
  console.error("Security check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Security check passed.");
