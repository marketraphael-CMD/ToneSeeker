# ToneForge — shared version

This package keeps the original ToneForge visible UI (HTML markup and CSS) and updates the JavaScript to search through a same-origin API. The backend queries Audius and Apple/iTunes in parallel in Auto mode, and checks Internet Archive only for audio items whose metadata explicitly identifies a Creative Commons or public-domain license.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000. The API health check is http://localhost:3000/api/health.

## Host it free so your friend can use it

1. Put `index.html`, `server.js`, `package.json`, and `render.yaml` in a GitHub repository.
2. In Render, create a **New Web Service** and connect that repository. Render should detect `render.yaml`; otherwise select Node, use `npm install` as the build command and `npm start` as the start command.
3. Choose the Free instance, deploy, and wait for the service URL (for example `https://your-service-name.onrender.com`).
4. Send that one URL to your friend. Both of you can use the same hosted app; no account or API key is required for the included sources.

Free web services may sleep when idle and take a little time to wake up. The first search after sleeping can be slow. Keep the repo private if you don't want to share the source code, but note that anyone with the deployed URL can use the app unless you add authentication.

## Audio availability notes

- Audius may provide full-length tracks uploaded by its creators.
- Apple/iTunes search normally returns short previews, not full songs.
- Internet Archive results are included only when the item metadata indicates a Creative Commons or public-domain license and an audio file is available.
- Auto mode combines available catalogs and ranks likely matches; it cannot guarantee every song is available.
- Remote audio analysis requires the audio host to permit cross-origin Web Audio access (CORS). If a source blocks it, use another result/source or an audio file you have permission to analyze locally.
- This project does not bypass paywalls, DRM, login requirements, or streaming-service restrictions.
