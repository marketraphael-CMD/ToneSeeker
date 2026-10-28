const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
app.disable('x-powered-by');
app.use(express.static(ROOT, { extensions: ['html'] }));

const clean = (s = '') => String(s).replace(/[<>\u0000-\u001f]/g, ' ').trim().slice(0, 180);
const norm = (s = '') => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const timeoutSignal = () => AbortSignal.timeout(8500);

async function getJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'ToneForge/1.0 (music search)' }, signal: timeoutSignal() });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

function relevance(item, song, artist) {
  const t = norm(item.trackName), a = norm(item.artistName), ws = norm(song), wa = norm(artist);
  let score = 0;
  if (t === ws) score += 12; else if (t.includes(ws) || ws.includes(t)) score += 7;
  if (a === wa) score += 10; else if (a.includes(wa) || wa.includes(a)) score += 5;
  if (item.isFullTrack) score += 2;
  if (item.previewOnly) score -= 1;
  return score;
}

async function searchAudius(song, artist) {
  const q = encodeURIComponent(`${song} ${artist}`);
  const data = await getJson(`https://discoveryprovider.audius.co/v1/tracks/search?query=${q}&limit=15&app_name=ToneForge`);
  return (data.data || []).filter(t => t && t.id && t.title).map(t => ({
    trackName: t.title,
    artistName: t.user?.name || artist,
    previewUrl: `https://discoveryprovider.audius.co/v1/tracks/${encodeURIComponent(t.id)}/stream?app_name=ToneForge`,
    artworkUrl: t.artwork?.['480x480'] || t.artwork?.['150x150'] || '',
    sourceName: 'Audius Open Protocol Stream', sourceKey: 'audius',
    isFullTrack: true, previewOnly: false,
    duration: Number.isFinite(t.duration) ? t.duration : null
  }));
}

async function searchITunes(song, artist) {
  const term = encodeURIComponent(`${song} ${artist}`);
  const data = await getJson(`https://itunes.apple.com/search?term=${term}&entity=song&limit=25&country=US`);
  return (data.results || []).filter(t => t.previewUrl).map(t => ({
    trackName: t.trackName || song,
    artistName: t.artistName || artist,
    previewUrl: t.previewUrl,
    artworkUrl: (t.artworkUrl100 || '').replace(/100x100[^/]*$/, '300x300bb.jpg'),
    sourceName: 'Apple Music/iTunes Preview (short clip)', sourceKey: 'itunes',
    isFullTrack: false, previewOnly: true,
    duration: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : null
  }));
}

// Internet Archive is used only when the item metadata explicitly identifies a
// Creative Commons or public-domain license. It is not a general-purpose song ripper.
async function searchArchive(song, artist) {
  const query = `mediatype:audio AND (title:"${song.replace(/["\\]/g, '')}" OR creator:"${artist.replace(/["\\]/g, '')}")`;
  const url = new URL('https://archive.org/advancedsearch.php');
  url.searchParams.set('q', query);
  url.searchParams.append('fl[]', 'identifier');
  url.searchParams.append('fl[]', 'title');
  url.searchParams.append('fl[]', 'creator');
  url.searchParams.set('rows', '8');
  url.searchParams.set('page', '1');
  url.searchParams.set('output', 'json');
  const data = await getJson(url.toString());
  const docs = data.response?.docs || [];
  const settled = await Promise.allSettled(docs.map(async doc => {
    const meta = await getJson(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`);
    const m = meta.metadata || {};
    const license = String(m.licenseurl || m.license || m.rights || '').toLowerCase();
    if (!/(creativecommons\.org|public.?domain|cc0)/i.test(license)) return null;
    const files = (meta.files || []).filter(f => {
      const name = String(f.name || '').toLowerCase();
      const format = String(f.format || '').toLowerCase();
      return !f.source?.includes('metadata') && Number(f.size || 0) > 0 &&
        (/\.(mp3|ogg|opus|flac|wav|m4a)$/i.test(name) || /^(vbr mp3|ogg vorbis|flac|wav|mpeg4 audio)$/i.test(format));
    }).sort((a,b) => {
      const rank = f => /\.mp3$/i.test(f.name || '') || /vbr mp3/i.test(f.format || '') ? 0 : 1;
      return rank(a) - rank(b) || Number(a.size || 0) - Number(b.size || 0);
    });
    if (!files.length) return null;
    const file = files[0];
    return {
      trackName: m.title || doc.title || song,
      artistName: Array.isArray(m.creator) ? m.creator.join(', ') : (m.creator || doc.creator || artist),
      previewUrl: `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${file.name.split('/').map(encodeURIComponent).join('/')}`,
      artworkUrl: '', sourceName: 'Internet Archive (licensed audio)', sourceKey: 'archive',
      isFullTrack: true, previewOnly: false, duration: null, license
    };
  }));
  return settled.filter(x => x.status === 'fulfilled' && x.value).map(x => x.value);
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ToneForge API' }));
app.get('/api/search', async (req, res) => {
  const song = clean(req.query.song);
  const artist = clean(req.query.artist);
  const source = ['auto', 'itunes', 'audius'].includes(req.query.source) ? req.query.source : 'auto';
  if (!song || !artist) return res.status(400).json({ error: 'Enter both a song title and artist.' });
  if (song.length < 1 || artist.length < 1) return res.status(400).json({ error: 'Song title and artist are required.' });

  const jobs = [];
  if (source === 'auto' || source === 'audius') jobs.push(searchAudius(song, artist));
  if (source === 'auto' || source === 'itunes') jobs.push(searchITunes(song, artist));
  if (source === 'auto') jobs.push(searchArchive(song, artist));
  const results = await Promise.allSettled(jobs);
  const tracks = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message || 'provider unavailable');
  const unique = new Map();
  for (const track of tracks) {
    const key = `${norm(track.trackName)}|${norm(track.artistName)}|${track.sourceKey}`;
    if (!unique.has(key)) unique.set(key, track);
  }
  const ranked = [...unique.values()].sort((a,b) => relevance(b, song, artist) - relevance(a, song, artist));
  if (!ranked.length) {
    return res.status(404).json({ error: `No playable match found for “${song}” by “${artist}”.`, message: errors.length ? `No result was found. Some catalogs were unavailable (${errors.join('; ')}). Try Auto-Select or check the spelling.` : undefined });
  }
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ results: ranked.slice(0, 30), providers: { checked: jobs.length, failed: errors.length }, note: 'iTunes results are previews; full-length playback depends on source availability.' });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`ToneForge running on port ${PORT}`));
