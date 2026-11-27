# Penn Theta Tau alumni directory

The directory is a static site. The public roster, search interface, career data, CSV importer, and deployment workflow are all in this repository.

## Run locally

Run `node scripts/build-public-careers.mjs` and open `docs/index.html`. Node is used for the data build. The browser runs the directory without a server.

## Publish on GitHub Pages

Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The deployment workflow runs on pushes to `main` and can also be triggered manually.

## Update the directory

Add confirmed career information to `data/public-careers.json` with the matching roster name and class year, a role, company, field, and a public source such as an employer or university bio. Include a LinkedIn profile URL when you have confirmed the match. Run the build script to validate the entries and regenerate the browser data. The build also runs on GitHub.

Use **Import form responses** in the directory to load a CSV downloaded from Google Sheets or Airtable. The importer parses the questionnaire answers in the browser and stores the imported records there. To clear the browser copy, use **Remove imported records**. The site has no server or shared database. Keep raw form exports and private response data out of the public repository.

## Shared-password directory

GitHub Pages serves the public roster. Deploy `server.mjs` to a Node host behind HTTPS to serve the complete directory. The host should rate-limit sign-in attempts at its HTTPS proxy. This server listens on loopback by default. Set `HOST` if your hosting platform requires a different bind address.

- Set `OT_DIRECTORY_PASSWORD` in the hosting provider's secrets.
- Run `node scripts/build-private-bundle.mjs RESPONSE_EXPORT directory.local.json` to combine the roster, headshots, sourced career details, and form responses. Mount the resulting file outside the public site and set `OT_DIRECTORY_DATA_FILE` to its path.
- Run `node scripts/build-public-careers.mjs` and start with `node server.mjs`.
- Enter any username and the shared chapter password when prompted. Rotate the password in the host's secrets and restart the server to revoke the previous password.

The password gate covers the directory HTML, scripts, and all roster and profile endpoints. Keep the private bundle out of GitHub and GitHub Pages artifacts.

