import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [responseFile, outputFile] = process.argv.slice(2);
if (!responseFile || !outputFile?.endsWith(".local.json")) {
  throw Error("Usage: node scripts/build-private-bundle.mjs RESPONSE_EXPORT OUTPUT.local.json");
}

async function readData(path, variable) {
  const raw = (await readFile(path, "utf8")).trim();
  return JSON.parse(raw.replace(new RegExp("^window\\." + variable + "\\s*=\\s*"), "").replace(/;\s*$/, ""));
}
const sources = {
  chapterRoster: new URL("../docs/roster.js", import.meta.url),
  chapterHeadshots: new URL("../docs/headshots.js", import.meta.url),
  publicCareers: new URL("../docs/public-careers.js", import.meta.url),
  formResponses: resolve(responseFile)
};
const records = await Promise.all(Object.entries(sources).map(async ([key,path]) => [key,await readData(path,key)]));
await writeFile(resolve(outputFile), JSON.stringify(Object.fromEntries(records)) + "\n", {flag:"wx", mode:0o600});
console.log("Created a private directory bundle. Upload it to your host's private storage.");

