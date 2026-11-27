import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";

const password = process.env.OT_DIRECTORY_PASSWORD;
const responsePath = process.env.OT_RESPONSES_FILE;
if (!password || !responsePath) throw Error("Set OT_DIRECTORY_PASSWORD and OT_RESPONSES_FILE before starting.");

const digest = value => createHash("sha256").update(value).digest();
const expected = digest(password);
const directory = new URL("./docs/", import.meta.url);
const javascript = "text/javascript; charset=utf-8";
const publicFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ...["directory.js", "roster.js", "headshots.js", "public-careers.js"].map(file => ["/" + file, [file, javascript]])
]);

const files = new Map();
for (const [route, [file, type]] of publicFiles) {
  files.set(route, {type, body:await readFile(new URL(file, directory))});
}

// Accept the existing generated snapshot or a plain JSON array. Re-serialize it
// as data so an export cannot inject code through the private script endpoint.
const snapshot = (await readFile(resolve(responsePath), "utf8")).trim();
const records = JSON.parse(snapshot.replace(/^window\.formResponses\s*=\s*/, "").replace(/;\s*$/, ""));
if (!Array.isArray(records) || !records.length) throw Error("Private response export must contain alumni records.");
files.set("/responses.js", {type:javascript, body:"window.formResponses = " + JSON.stringify(records) + ";\n"});

function authorized(header = "") {
  const encoded = header.match(/^Basic\s+([\w+/]+={0,2})$/i)?.[1];
  if (!encoded) return false;
  const credentials = Buffer.from(encoded, "base64").toString("utf8");
  const separator = credentials.indexOf(":");
  return separator >= 0 && timingSafeEqual(digest(credentials.slice(separator + 1)), expected);
}

const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Authorization");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
  response.setHeader("Referrer-Policy", "no-referrer");

  if (!authorized(request.headers.authorization)) {
    response.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="Penn Theta Tau Alumni", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Enter any username and the shared chapter password.");
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, {Allow:"GET, HEAD"});
    response.end();
    return;
  }
  const file = files.get(request.url.split("?", 1)[0]);
  if (!file) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, {"Content-Type":file.type});
  response.end(request.method === "HEAD" ? undefined : file.body);
});

server.listen(Number(process.env.PORT || 8080), process.env.HOST || "127.0.0.1", () => {
  console.log("Alumni directory listening on port " + server.address().port);
});

