import { readFile, writeFile } from "node:fs/promises";

const project = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, project), "utf8");
const rows = JSON.parse(await read("data/public-careers.json"));
const roster = JSON.parse((await read("docs/roster.js")).trim().replace(/^window\.chapterRoster = /, "").replace(/;$/, ""));
const key = person => person.name.trim().toLowerCase() + "|" + person.year;
const rosterKeys = new Set(roster.map(key));
const usedKeys = new Set();

for (const row of rows) {
  const id = key(row);
  if (!rosterKeys.has(id) || usedKeys.has(id)) throw Error("Unknown or duplicate roster entry: " + id);
  usedKeys.add(id);
  const { protocol, hostname } = new URL(row.url);
  if (protocol !== "https:" || /(^|\.)linkedin\.com$/i.test(hostname)) throw Error("Expected a public bio source: " + id);
  if (!row.role || !row.company || !row.field) throw Error("Incomplete career entry: " + id);
  if (row.profile && !/^https:\/\/www\.linkedin\.com\/in\/[\w%-]+\/?$/.test(row.profile)) throw Error("Invalid LinkedIn profile URL: " + id);
}
const publicRecords = rows.map(({ name, year, role, company, field, url, profile }) => ({ name, year, role, company, field, url, profile }));
await writeFile(new URL("docs/public-careers.js", project), "window.publicCareers = " + JSON.stringify(publicRecords, null, 2) + ";\n");

