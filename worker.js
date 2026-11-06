// driving.7mit on Cloudflare Workers: the game itself is static (the simulator folder, served as assets); this script only adds
// GET /api/yt-search?q=… for the radio and the Musik app. The public search mirrors they used to rely on are mostly gone, so the
// search is done here: it reads YouTube's own results page and returns a short list [{id, title, by, dur}] (dur in seconds).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const secs = t => String(t || '').split(/[:.]/).reduce((a, x) => a*60 + (+x || 0), 0);
// the videos in a YouTube results page (the page carries its data as `var ytInitialData = {...};`)
export function parseResults(html){
  const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html || ''); if (!m) return []; let data; try { data = JSON.parse(m[1]); } catch (e) { return []; }
  const out = [], walk = o => { if (!o || typeof o !== 'object' || out.length >= 20) return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const v = o.videoRenderer; if (v && /^[\w-]{11}$/.test(v.videoId || '') && v.lengthText) { const dur = secs(v.lengthText.simpleText);
      out.push({id: v.videoId, title: ((v.title && v.title.runs) || []).map(r => r.text).join('').slice(0, 120), by: ((v.ownerText && v.ownerText.runs) || [{}])[0].text || '', dur}); }
    for (const k in o) walk(o[k]); };
  walk(data); return out.filter(v => v.title && v.dur > 30 && v.dur < 3600).slice(0, 10); }
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...extra}});
export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);
    if (url.pathname !== '/api/yt-search') return env.ASSETS.fetch(request);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 100); if (!q) return json([], 400);
    const key = new Request(`https://yt-search.cache/${encodeURIComponent(q.toLowerCase())}`), cache = caches.default, hit = await cache.match(key); if (hit) return hit;
    try {
      const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D`, {headers: {'user-agent': UA, 'accept-language': 'id-ID,id;q=0.9,en;q=0.8', cookie: 'CONSENT=YES+1; SOCS=CAI'}});
      const items = r.ok ? parseResults(await r.text()) : []; if (!items.length) return json([], 502, {'cache-control': 'no-store'});
      const res = json(items, 200, {'cache-control': 'public, max-age=3600'}); ctx.waitUntil(cache.put(key, res.clone())); return res;
    } catch (e) { return json([], 502, {'cache-control': 'no-store'}); } }
};
