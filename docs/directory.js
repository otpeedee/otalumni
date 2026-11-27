"use strict";

const byId = id => document.getElementById(id);
const rosterUrl = "https://www.upennthetatau.com/alumni";
const storageKey = "penn-ot-form-responses";
const dimensions = ["field", "company", "year"];
const normalize = value => String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const identity = row => normalize(row.name) + "|" + (row.year || "");
const labels = {field: "fields", company: "companies", year: "class years"};
let chapterHeadshots = {};
const profileSections = [
  ["Contact", {email:"Email", phone:"Phone"}],
  ["Current work", {currentWork:"Role and company", responsibilities:"What their work entails"}],
  ["Previous experience", {experience:"Roles and responsibilities"}],
  ["Education and chapter", {major:"Major", graduation:"Graduation year", pledgeClass:"Pledge class", location:"Location"}],
  ["Graduate education", {graduateSchool:"School", graduateYear:"Graduation year", graduateMajor:"Major", degree:"Degree", graduateNotes:"Additional notes"}],
  ["Connecting with this alum", {willingToSpeak:"Willing to speak with brothers", referrals:"Referrals", mockInterviews:"Mock interviews"}],
  ["Additional notes", {notes:"From the alum"}]
];
const aliases = {
  name: ["full name", "alumni name", "name", "name first last", "first and last name"],
  year: ["class year", "graduation year", "year graduated", "graduating class", "class of", "year"],
  company: ["current employer", "current company", "company organization", "company", "employer", "organization"],
  field: ["industry", "career field", "field", "professional field", "sector"],
  role: ["job title", "current role", "position", "role", "title"],
  profile: ["linkedin url", "linkedin link", "linkedin profile", "linkedin"]
};
const answerColumns = {
  major: "major", pledgeClass: "pledge class", graduation: "graduation year", location: "current location",
  currentWork: "current role and company", responsibilities: "please describe what your current role entails",
  experience: "please list your previous work experiences", willingToSpeak: "are you willing to speak",
  referrals: "can you refer brothers", notes: "anything else you would like to add",
  graduateSchool: "name of graduate school", degree: "degree type", mockInterviews: "are you willing to mock interview"
};

let imported = [];
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
  if (Array.isArray(saved)) imported = saved;
} catch {}
let alumni = [];

function merge() {
  const people = new Map(window.chapterRoster.map(row => [identity(row), {
    ...row, roster: true, headshot: chapterHeadshots[row.name]
  }]));
  for (const career of window.publicCareers) {
    const person = people.get(identity(career));
    if (!person) continue;
    for (const key of ["role", "company", "field", "url", "profile"]) {
      if (!person[key] && career[key]) person[key] = career[key];
    }
  }
  for (const row of [...window.formResponses, ...imported]) {
    const matches = [...people.entries()].filter(([, person]) => normalize(person.name) === normalize(row.name));
    const compatible = matches.filter(([, person]) => !row.year || !person.year || person.year === row.year);
    const key = people.has(identity(row)) ? identity(row) : compatible.length === 1 ? compatible[0][0] : identity(row);
    const previous = people.get(key);
    const person = {...previous, ...row};
    if (row.answers) {
      person.answers = {...previous?.answers};
      for (const [field, answer] of Object.entries(row.answers)) {
        person.answers[field] = [...new Set([answer, ...(person.answers[field] || [])])];
      }
    }
    people.delete(key);
    people.set(identity(person), person);
  }
  alumni = [...people.values()].sort((a,b) => Number(Boolean(b.company || b.field)) - Number(Boolean(a.company || a.field)) || a.name.localeCompare(b.name));
}

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function link(label, url) {
  const anchor = element("a", label);
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

function linkedIn(person) {
  if (person.profile) return link("LinkedIn profile", person.profile);
  const url = new URL("https://www.linkedin.com/search/results/people/");
  url.searchParams.set("keywords", person.name + " University of Pennsylvania");
  return link("Search on LinkedIn", url.href);
}

function profileAnswer(field, answer) {
  const details = element("dd");
  if (field !== "email" && field !== "phone") {
    details.textContent = answer;
    return details;
  }
  for (const value of answer.split("\n")) {
    const item = element("div", value);
    const phone = value.replace(/[^\d+]/g, "");
    const href = field === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? "mailto:" + encodeURIComponent(value).replace(/%40/g, "@")
      : field === "phone" && /^\+?\d{7,15}$/.test(phone) ? "tel:" + phone : "";
    if (href) {
      const anchor = element("a", value);
      anchor.href = href;
      item.replaceChildren(anchor);
    }
    details.append(item);
  }
  return details;
}

function avatar(person) {
  const container = element("span", "", "avatar");
  container.setAttribute("aria-hidden", "true");
  const initials = element("span", person.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(), "initials");
  container.append(initials);
  const photo = person.headshot;
  if (photo) {
    const image = element("img", "", "headshot");
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.remove(), {once:true});
    image.src = photo;
    container.append(image);
  }
  return container;
}

function openProfile(person) {
  const dialog = byId("profile");
  byId("profile-name").textContent = person.name;
  byId("profile-avatar")?.replaceChildren(avatar(person));
  byId("profile-summary").textContent = [person.year && "Class of " + person.year, person.role, person.company].filter(Boolean).join(" · ");
  byId("profile-links").replaceChildren(linkedIn(person));
  const content = byId("profile-content");
  content.replaceChildren();
  for (const [title, fields] of profileSections) {
    const list = element("dl");
    for (const [key, label] of Object.entries(fields)) {
      const answers = person.answers?.[key];
      if (!answers?.length) continue;
      list.append(element("dt", label), ...answers.map(answer => profileAnswer(key, answer)));
    }
    if (!list.childElementCount) continue;
    const section = element("section");
    section.append(element("h3", title), list);
    content.append(section);
  }
  dialog.showModal();
}

function card(person) {
  const item = element("article", "", "card");
  const head = element("div", "", "card-head");
  const name = element("div");
  name.append(element("h3", person.name));
  if (person.year) name.append(element("small", "Class of " + person.year));
  head.append(avatar(person), name);
  item.append(head, element("p", [person.role,person.company,person.field].filter(Boolean).join(" · ") || "Career details unavailable"));
  if (person.roster) item.append(link("Chapter roster", rosterUrl));
  if (person.url) item.append(link("Career source", person.url));
  item.append(linkedIn(person));
  if (person.answers || person.headshot) {
    const button = element("button", "View profile", "profile-button");
    button.type = "button";
    button.setAttribute("aria-label", "View profile for " + person.name);
    button.addEventListener("click", () => openProfile(person));
    item.append(button);
  }
  return item;
}

function updateOptions() {
  for (const dimension of dimensions) {
    const select = byId(dimension);
    const previous = select.value;
    const values = new Map();
    for (const row of alumni) {
      if (row[dimension]) values.set(normalize(row[dimension]), row[dimension]);
    }
    const sorted = [...values].sort((a,b) => dimension === "year" ? b[1] - a[1] : a[1].localeCompare(b[1]));
    select.replaceChildren(new Option("All " + labels[dimension], ""), ...sorted.map(([key,value]) => new Option(value,key)));
    if (values.has(previous)) select.value = previous;
  }
}

function render() {
  const terms = normalize(byId("search").value).split(" ").filter(Boolean);
  const matches = alumni.filter(row => {
    const haystack = normalize([row.name,row.year,row.field,row.role,row.company,...Object.values(row.answers || {}).flat()].join(" "));
    return terms.every(term => haystack.includes(term)) && dimensions.every(key => !byId(key).value || normalize(row[key]) === byId(key).value);
  });
  byId("count").textContent = matches.length + " of " + alumni.length + " alumni";
  const target = byId("results");
  target.replaceChildren();
  if (!matches.length) {
    target.append(element("p","No alumni match these filters."));
    return;
  }

  const group = byId("group").value;
  const buckets = new Map();
  for (const row of matches) {
    const label = group ? String(row[group] || "Unspecified") : "";
    const key = normalize(label);
    if (!buckets.has(key)) buckets.set(key,{label, rows:[]});
    buckets.get(key).rows.push(row);
  }
  const groups = [...buckets.values()].sort((a,b) => {
    if (a.label === "Unspecified") return 1;
    if (b.label === "Unspecified") return -1;
    return group === "year" ? Number(b.label) - Number(a.label) : a.label.localeCompare(b.label);
  });
  for (const {label, rows} of groups) {
    if (label) target.append(element("h2", label + " (" + rows.length + ")"));
    const grid = element("div","","grid");
    grid.append(...rows.map(card));
    target.append(grid);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (!quoted && (char === "\r" || char === "\n")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      rows.push([...row, cell.trim()]);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("A quoted CSV value is unfinished.");
  rows.push([...row, cell.trim()]);
  return rows.filter(values => values.some(Boolean));
}

function readImport(text) {
  const [header=[], ...rows] = parseCsv(text);
  const headers = header.map(normalize);
  const columns = Object.fromEntries(Object.entries(aliases).map(([key,names]) => [key,names.map(name => headers.indexOf(name)).find(index => index >= 0) ?? -1]));
  const first = headers.indexOf("first name");
  const last = headers.indexOf("last name");
  const answerIndexes = Object.fromEntries(Object.entries(answerColumns).map(([key, prefix]) =>
    [key, headers.findIndex(header => header === prefix || header.startsWith(prefix + " "))]));
  const graduateStart = answerIndexes.graduateSchool;
  if (graduateStart >= 0) {
    answerIndexes.graduateYear = headers.indexOf("graduation year", graduateStart + 1);
    answerIndexes.graduateMajor = headers.indexOf("major", graduateStart + 1);
    answerIndexes.graduateNotes = headers.indexOf("anything else you would like to add", graduateStart + 1);
  }
  if (columns.name < 0 && (first < 0 || last < 0)) throw new Error("The CSV needs a Name column or First Name and Last Name columns.");
  return rows.flatMap(row => {
    const name = row[columns.name] || [row[first],row[last]].filter(Boolean).join(" ");
    if (!name) return [];
    const record = {name,form:true};
    const year = row[columns.year]?.match(/\b(?:19|20)\d{2}\b/);
    if (year) record.year = Number(year[0]);
    for (const key of ["field","company","role"]) {
      if (row[columns[key]]) record[key] = row[columns[key]];
    }
    const answers = Object.fromEntries(Object.entries(answerIndexes).filter(([, index]) => row[index]).map(([key, index]) => [key, row[index]]));
    if (Object.keys(answers).length) record.answers = answers;
    if (answers.currentWork && !record.role && !record.company) {
      const [role, company] = answers.currentWork.split(/\s+(?:at|@)\s+|,\s+/i);
      if (company && !/^\d{4}/.test(company)) {
        record.role = role;
        record.company = company.replace(/\s+\d{4}\s*[-–].*$/, "").trim();
      }
    }
    const profile = row[columns.profile];
    if (profile) {
      try {
        const url = new URL(/^https?:\/\//i.test(profile) ? profile : "https://" + profile);
        if (/(^|\.)linkedin\.com$/i.test(url.hostname) && /^\/in\/[^/]+/.test(url.pathname)) record.profile = "https://www.linkedin.com" + url.pathname;
      } catch {}
    }
    return [record];
  });
}

function refresh() {
  merge();
  updateOptions();
  render();
}
byId("filters").addEventListener("submit", event => event.preventDefault());
byId("filters").addEventListener("input", render);
byId("group").addEventListener("change", render);
byId("reset").addEventListener("click", () => {
  byId("filters").reset();
  dimensions.forEach(key => { byId(key).value = ""; });
  render();
});
byId("csv").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const records = readImport(await file.text());
    if (!records.length) throw new Error("The CSV contains no named alumni.");
    localStorage.setItem(storageKey,JSON.stringify(records));
    imported = records;
    refresh();
    byId("import-status").textContent = "Imported " + records.length + " form responses.";
  } catch (error) {
    byId("import-status").textContent = error.message;
  } finally {
    event.target.value = "";
  }
});
byId("remove").addEventListener("click", () => {
  localStorage.removeItem(storageKey);
  imported = [];
  refresh();
  byId("import-status").textContent = "Imported responses removed from this browser.";
});
byId("unlock-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  const status = byId("unlock-status");
  const input = byId("password");
  button.disabled = true;
  status.textContent = "Unlocking directory…";
  try {
    const response = await fetch("https://ot-alumni-directory-api.tweedyode3.chatgpt.site/pages-alumni", {
      method: "POST",
      body: new URLSearchParams({password:input.value})
    });
    if (response.status === 401) {
      status.textContent = "Incorrect password. Try again.";
      input.select();
      return;
    }
    if (!response.ok) throw Error("Directory unavailable.");
    const data = await response.json();
    window.chapterRoster = data.chapterRoster;
    window.publicCareers = data.publicCareers;
    window.formResponses = data.formResponses;
    chapterHeadshots = data.chapterHeadshots;
    input.value = "";
    refresh();
    byId("unlock").hidden = true;
    byId("directory").hidden = false;
    byId("search").focus();
  } catch {
    status.textContent = "The directory couldn’t load. Please try again.";
  } finally {
    button.disabled = false;
  }
});

