import { execFileSync } from "node:child_process";

// Use ripgrep if available, fall back to grep -r
let output = "";
try {
  output = execFileSync("rg", ["-l", 'from ["\\\']epubjs["\\\']', "src"], {
    encoding: "utf8",
  }).trim();
} catch {
  try {
    output = execFileSync(
      "grep",
      ["-rl", '--include=*.ts', '--include=*.tsx', 'from ["\']epubjs["\']', "src"],
      { encoding: "utf8" },
    ).trim();
  } catch {
    output = "";
  }
}

const files = output ? output.split("\n") : [];
const invalid = files.filter((file) => file !== "src/engine/epub/EpubJsDriver.ts");

if (invalid.length > 0) {
  process.stderr.write(`epub.js boundary violation:\n${invalid.join("\n")}\n`);
  process.exit(1);
}
