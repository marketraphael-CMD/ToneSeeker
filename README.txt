ToneForge same-origin audio proxy update

Replace index.html, server.js, and package.json in your repository with these files.
The visible UI is unchanged. The API now proxies approved Audius, iTunes, and Internet Archive audio through /api/stream, forwarding HTTP Range requests and validating redirect hosts.

Requirements: Node.js 20+ and npm install. Deploy/restart the app after committing.

Spotify is still used only for public track metadata; this does not download Spotify audio. Custom direct audio URLs still use the browser's direct playback path and may be subject to the host's CORS/media policies.

Check after deployment:
  GET /api/health
Expected: {"ok":true,"service":"ToneForge API"}
Then test a catalog search and playback. A successful health check alone does not prove each provider has playable audio.
