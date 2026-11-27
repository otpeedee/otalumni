import { readFile, writeFile } from "node:fs/promises";

const source = "https://www.upennthetatau.com/alumni";
const root = new URL("../", import.meta.url);
const rosterText = await readFile(new URL("docs/roster.js", root), "utf8");
const roster = JSON.parse(rosterText.trim().replace(/^window\.chapterRoster = /, "").replace(/;$/, ""));
const normalize = name => name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
const rosterNames = new Map(roster.map(({name}) => [normalize(name), name]));
const entities = { amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">" };
const decode = value => value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
  if (entity[0] !== "#") return entities[entity] ?? match;
  const code = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
});

async function downloadRoster() {
  const response = await fetch(source, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw Error("Chapter roster returned HTTP " + response.status);
  return response.text();
}

const html = process.argv[2] ? await readFile(process.argv[2], "utf8") : await downloadRoster();
const photos = new Map();
for (const [,figure] of html.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi)) {
  const caption = figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1];
  const images = [...figure.matchAll(/<img\b[^>]*>/gi)];
  if (!caption || images.length !== 1) continue;

  const name = rosterNames.get(normalize(decode(caption.replace(/<[^>]+>/g, " "))));
  const src = images[0][0].match(/\bdata-src="([^"]+)"/i)?.[1];
  if (!name || !src) continue;
  const url = new URL(decode(src), source);
  if (url.protocol !== "https:" || url.hostname !== "images.squarespace-cdn.com") continue;
  url.searchParams.set("format", "300w");
  if (!photos.has(name)) photos.set(name, new Set());
  photos.get(name).add(url.href);
}

const unambiguous = [...photos].filter(([,urls]) => urls.size === 1).map(([name,urls]) => [name, [...urls][0]]);
const usage = new Map();
for (const [,url] of unambiguous) usage.set(url, (usage.get(url) || 0) + 1);
const entries = unambiguous.filter(([,url]) => usage.get(url) === 1).sort(([a],[b]) => a.localeCompare(b, "en"));
if (!entries.length) throw Error("No named roster headshots matched. Check the chapter page layout.");

await writeFile(new URL("docs/headshots.js", root), "window.chapterHeadshots = " + JSON.stringify(Object.fromEntries(entries), null, 2) + ";\n");
console.log("Matched " + entries.length + " individual chapter headshots.");

