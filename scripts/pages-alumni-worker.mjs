const origin = "https://otpeedee.github.io";
const headers = {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Cache-Control":"no-store","Vary":"Origin","X-Content-Type-Options":"nosniff"};
const privateHeaders = {"Cache-Control":"no-store"};
const json = (value, status=200, extra=privateHeaders) => Response.json(value,{status,headers:extra});

async function compare(a,b) {
  const hash = value => crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  const [first,second] = (await Promise.all([hash(a),hash(b)])).map(bytes=>new Uint8Array(bytes));
  let diff=0;
  for(let i=0;i<first.length;i++) diff|=first[i]^second[i];
  return diff===0;
}

async function snapshot(env) {
  const parts=Array.from({length:Number(env.OT_DATA_PARTS)},(_,i)=>env["OT_DATA_"+i]);
  if(!parts.length||parts.some(part=>!part)) throw Error("Missing directory snapshot");
  const compressed=Uint8Array.from(atob(parts.join("")),char=>char.charCodeAt(0));
  return new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"))).json();
}

const normalize = name => name.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const key = row => normalize(row.name)+"|"+row.year;
const near = (a,b) => {
  const [firstA,...restA]=normalize(a.name).split(" ");
  const [firstB,...restB]=normalize(b.name).split(" ");
  return a.year===b.year && restA.length && restB.length && restA.at(-1)===restB.at(-1) && firstA[0]===firstB[0];
};

async function updates(bucket) {
  const records=[];
  let cursor;
  do {
    const page=await bucket.list({prefix:"accepted/",cursor});
    const objects=await Promise.all(page.objects.map(item=>bucket.get(item.key)));
    records.push(...await Promise.all(objects.filter(Boolean).map(record=>record.json())));
    cursor=page.truncated?page.cursor:undefined;
  } while(cursor);
  return records.sort((a,b)=>a.submittedAt-b.submittedAt||a.id.localeCompare(b.id));
}

function applyUpdates(data, records) {
  const grouped=new Map();
  for(const record of records){
    const id=key(record);
    if(!grouped.has(id)){
      const existing=data.formResponses.filter(row=>key(row)===id);
      const canonical=data.chapterRoster.find(row=>key(row)===id)?.name;
      grouped.set(id,{...Object.assign({},...existing),name:canonical||existing.at(-1)?.name||record.name,year:record.year,form:true,answers:Object.assign({},...existing.map(row=>row.answers))});
    }
    const row=grouped.get(id);
    Object.assign(row.answers,record.answers);
    for(const field of ["company","role","field","profile"]){
      if(record[field])row[field]=record[field];
    }
  }
  data.formResponses=data.formResponses.filter(row=>!grouped.has(key(row))).concat([...grouped.values()]);
  return data;
}

async function submit(request,env) {
  if(request.method!=="POST")return json({status:"method_not_allowed"},405);
  if(!env.OT_SYNC_TOKEN||!env.UPDATES)return json({status:"unavailable"},503);
  if(!await compare(request.headers.get("Authorization")||"","Bearer "+env.OT_SYNC_TOKEN))return json({status:"unauthorized"},401);
  const text=await request.text();
  if(text.length>60000)return json({status:"too_large"},413);
  let record;
  try{record=JSON.parse(text)}catch{return json({status:"invalid"},400)}
  if(!record||typeof record.id!=="string"||!/^[\w-]{1,100}$/.test(record.id)||typeof record.name!=="string"||!normalize(record.name)||record.name.length>150||!Number.isSafeInteger(record.submittedAt)||!record.answers||typeof record.answers!=="object"||Array.isArray(record.answers))return json({status:"invalid"},400);
  if(await env.UPDATES.head("accepted/"+record.id+".json"))return json({status:"accepted"});
  if(await env.UPDATES.head("review/"+record.id+".json"))return json({status:"review_required"},202);
  const allowed=["email","phone","major","pledgeClass","graduation","location","currentWork","responsibilities","experience","willingToSpeak","referrals","notes","graduateSchool","graduateYear","graduateMajor","degree","graduateNotes","mockInterviews"];
  record.answers=Object.fromEntries(allowed.filter(field=>typeof record.answers[field]==="string"&&record.answers[field].trim()).map(field=>[field,record.answers[field].trim()]));
  for(const field of ["company","role","field"]){if(typeof record[field]!=="string"||!record[field].trim())delete record[field]}
  delete record.profile;
  const data=await snapshot(env);
  const accepted=await updates(env.UPDATES);
  const people=[...data.chapterRoster,...data.formResponses,...accepted];
  const exact=people.some(person=>key(person)===key(record));
  const possible=people.some(person=>normalize(person.name)===normalize(record.name)||near(person,record));
  const review=!Number.isInteger(record.year)||record.year<1900||record.year>2100||(!exact&&possible);
  const path=(review?"review/":"accepted/")+record.id+".json";
  await env.UPDATES.put(path,JSON.stringify(record),{onlyIf:{etagDoesNotMatch:"*"}});
  return json({status:review?"review_required":"accepted"},review?202:200);
}

export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path==="/sync-alumni")return submit(request,env);
    if(path!=="/pages-alumni"||request.headers.get("Origin")!==origin)return new Response(null,{status:404});
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    if(request.method!=="POST")return new Response(null,{status:405,headers});
    if(!env.OT_PASSWORD||!env.OT_DATA_PARTS)return new Response(null,{status:503,headers});
    const body=await request.text();
    if(body.length>1024)return new Response(null,{status:413,headers});
    if(!await compare(new URLSearchParams(body).get("password")||"",env.OT_PASSWORD))return new Response(null,{status:401,headers});
    const data=await snapshot(env);
    return json(applyUpdates(data,env.UPDATES?await updates(env.UPDATES):[]),200,headers);
  }
};

