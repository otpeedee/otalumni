const origin = "https://otpeedee.github.io";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff"
};

const compare = async (a, b) => {
  const hash = value => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [first, second] = (await Promise.all([hash(a), hash(b)])).map(bytes => new Uint8Array(bytes));
  let diff = 0;
  for (let i = 0; i < first.length; i++) diff |= first[i] ^ second[i];
  return diff === 0;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/pages-alumni" || request.headers.get("Origin") !== origin) return new Response(null,{status:404});
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
    if (request.method !== "POST") return new Response(null,{status:405,headers});
    if (!env.OT_PASSWORD || !env.OT_DATA_PARTS) return new Response(null,{status:503,headers});
    const length = Number(request.headers.get("Content-Length"));
    if (length > 1024) return new Response(null,{status:413,headers});
    const body = await request.text();
    if (body.length > 1024) return new Response(null,{status:413,headers});
    if (!await compare(new URLSearchParams(body).get("password") || "", env.OT_PASSWORD)) {
      return new Response(null,{status:401,headers});
    }
    const parts = Array.from({length:Number(env.OT_DATA_PARTS)},(_,i)=>env["OT_DATA_" + i]);
    if (parts.some(part => !part)) return new Response(null,{status:503,headers});
    const compressed = Uint8Array.from(atob(parts.join("")), char => char.charCodeAt(0));
    const json = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(json,{headers:{...headers,"Content-Type":"application/json; charset=utf-8"}});
  }
};

