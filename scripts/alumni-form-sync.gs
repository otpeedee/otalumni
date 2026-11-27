const ALUMNI_SYNC_URL = "https://ot-alumni-directory-api.tweedyode3.chatgpt.site/sync-alumni";
const ALUMNI_RESPONSE_TAB = "Form Responses 1";

function installAlumniSync() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || !spreadsheet.getSheetByName(ALUMNI_RESPONSE_TAB)) {
    throw new Error("Open Apps Script from the alumni response spreadsheet.");
  }
  if (!PropertiesService.getScriptProperties().getProperty("OT_SYNC_TOKEN")) {
    throw new Error("Set the OT_SYNC_TOKEN script property before installing.");
  }
  if (ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === "syncAlumniFormResponse")) return;
  ScriptApp.newTrigger("syncAlumniFormResponse").forSpreadsheet(spreadsheet).onFormSubmit().create();
}

function syncAlumniFormResponse(event) {
  if (!event || event.range.getSheet().getName() !== ALUMNI_RESPONSE_TAB) return;
  const sheet = event.range.getSheet();
  const headers = sheet.getRange(1, 1, 1, event.values.length).getDisplayValues()[0];
  const normalize = value => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  const columns = headers.map(normalize);
  const current = prefix => columns.findIndex(header => header.startsWith(prefix));
  const graduate = current("name of graduate school");
  const fields = {
    email:current("email"), phone:current("phone number"), major:current("major"),
    pledgeClass:current("pledge class"), graduation:current("graduation year"),
    location:current("current location"), currentWork:current("current role and company"),
    responsibilities:current("please describe what your current role entails"),
    experience:current("please list your previous work experiences"),
    willingToSpeak:current("are you willing to speak"), referrals:current("can you refer brothers"),
    notes:current("anything else you would like to add"), graduateSchool:graduate,
    graduateYear:graduate < 0 ? -1 : columns.indexOf("graduation year", graduate + 1),
    graduateMajor:graduate < 0 ? -1 : columns.indexOf("major", graduate + 1),
    degree:current("degree type"),
    graduateNotes:graduate < 0 ? -1 : columns.indexOf("anything else you would like to add?", graduate + 1),
    mockInterviews:current("are you willing to mock interview")
  };
  const name = String(event.values[columns.indexOf("name")] || "").trim();
  if (!name) throw new Error("Could not find the name in the submitted response.");
  const answers = Object.fromEntries(Object.entries(fields).map(([field,index]) =>
    [field,String(event.values[index] || "").trim()]).filter(([,value]) => value));
  const year = Number((answers.graduation || "").match(/\b(?:19|20)\d{2}\b/)?.[0]) || null;
  const stamp = sheet.getRange(event.range.getRow(),1).getValue();
  const submittedAt = stamp instanceof Date ? stamp.getTime() : new Date(stamp).getTime();
  if (!Number.isFinite(submittedAt)) throw new Error("Could not read the form timestamp.");
  const id = [sheet.getSheetId(),event.range.getRow(),submittedAt].join("-");
  const payload = {id,name,year,submittedAt,answers};
  const [role,company] = (answers.currentWork || "").split(/\s+(?:at|@)\s+|,\s+/i);
  if (company && !/^\d{4}/.test(company)) {
    payload.role = role;
    payload.company = company.replace(/\s+\d{4}\s*[-–].*$/, "").trim();
  }
  const token = PropertiesService.getScriptProperties().getProperty("OT_SYNC_TOKEN");
  if (!token) throw new Error("Missing OT_SYNC_TOKEN script property.");
  const options = {method:"post",contentType:"application/json",headers:{Authorization:"Bearer " + token},payload:JSON.stringify(payload),muteHttpExceptions:true};
  for(let attempt=0;attempt<3;attempt++){
    const status = UrlFetchApp.fetch(ALUMNI_SYNC_URL,options).getResponseCode();
    if(status===200)return;
    if(status===202){console.warn("Alumni directory review required for sheet row " + event.range.getRow());return;}
    if(status<500||attempt===2)throw new Error("Alumni sync failed with HTTP " + status + " for row " + event.range.getRow());
    Utilities.sleep(1000*(attempt+1));
  }
}

