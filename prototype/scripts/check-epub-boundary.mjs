import { execFileSync } from "node:child_process";

const output = execFileSync("rg", ["-l", 'from ["\\\']epubjs["\\\']', "src"], {
  encoding: "utf8",
}).trim();
const files = output ? output.split("\n") : [];
const invalid = files.filter((file) => file !== "src/engine/epub/EpubJsDriver.ts");

if (invalid.length > 0) {
  process.stderr.write(`epub.js boundary violation:\n${invalid.join("\n")}\n`);
  process.exit(1);
}
