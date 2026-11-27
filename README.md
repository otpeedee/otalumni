# Penn Theta Tau alumni directory

GitHub Pages serves the password form and frontend. The browser submits the chapter password to the Sites backend, which returns the roster, headshots, sourced career details, and detailed form responses after verification.

Publish the root of main on GitHub Pages for the main URL to redirect to the directory in docs. The deployment workflow can also publish docs directly.

The Sites runtime stores the password and compressed data as secret environment values. Its worker source is in scripts/pages-alumni-worker.mjs. The GitHub Pages files contain no directory dataset or password. Update the private data bundle and runtime secrets to refresh the directory.

## Sync new Google Form responses

Open the response spreadsheet and choose Extensions > Apps Script. Paste the contents of scripts/alumni-form-sync.gs into the script editor. In Project Settings, add a Script Property named OT_SYNC_TOKEN using the private token provisioned for the alumni backend. Run installAlumniSync once and authorize it using a spreadsheet editor account.

New responses with an exact name and graduation-year match update the existing profile. Responses without a match create a new profile. Potential matches and invalid graduation years are held privately for review, and the Apps Script execution log gives the response row number. Repeated delivery of the same submission is safe. Existing profiles remain available while the trigger is being set up.

