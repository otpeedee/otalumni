# Penn Theta Tau alumni directory

GitHub Pages serves the password form and frontend. The browser submits the chapter password to the Sites backend, which returns the roster, headshots, sourced career details, and detailed form responses after verification.

Publish the root of main on GitHub Pages for the main URL to redirect to the directory in docs. The deployment workflow can also publish docs directly.

The Sites runtime stores the password and compressed data as secret environment values. Its worker source is in scripts/pages-alumni-worker.mjs. The GitHub Pages files contain no directory dataset or password. Update the private data bundle and runtime secrets to refresh the directory.

