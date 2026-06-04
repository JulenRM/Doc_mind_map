# Doc Mind Map

Static LLM Document Tree Visualizer.

## Files

- `index.html` contains the page structure.
- `styles.css` contains the visual styles.
- `app.js` contains upload, LLM requests, Mermaid rendering, editing, and downloads.

## Run

Open `index.html` in a browser.

## Deploy to GitHub Pages

This repository includes `.github/workflows/deploy.yml`, which deploys the static site on every push to `main`.

In GitHub, go to Settings -> Pages -> Source and select GitHub Actions. Then push to `main` or run the workflow manually.

API keys are only read from the form when a request is made. The app does not use local storage, session storage, cookies, or any client-side cache for keys.

Mermaid rendering uses the Mermaid CDN. Some LLM providers may block direct browser requests with CORS rules; in that case, use a custom endpoint or proxy that accepts the same chat-style payload.

The results area can switch between a single-column JSON view and a two-column Mermaid workspace. JSON and Mermaid can both be edited and restored to their original generated versions.

In Mermaid view, the visual editor lets you rename nodes, add nodes, delete nodes, reconnect nodes, and delete connections without editing code.
