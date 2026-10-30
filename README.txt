ToneForge combined update

Replace index.html, server.js, and package.json in your repository. Keep your existing environment settings private. The app uses Spotify only for public track metadata; playable audio is searched from Audius, iTunes previews, and explicitly licensed Internet Archive files. Auto Search now fetches the selected playable audio in the browser, runs HT-Demucs guitar separation, plays the original track, and analyzes only the separated guitar stem.

Important: browser separation requires the selected audio host to allow CORS. If it blocks browser access, ToneForge reports an error instead of analyzing the full mix. The first model load is approximately 136 MB and uses around 1.1 GB RAM.
