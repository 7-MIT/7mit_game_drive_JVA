// In-game bug report: what happened (the player's words), a screenshot of the game and a log (device, settings, where you are,
// the last errors) go to the driving.7mit team (function drive7_report). Offline or when sending fails, the report is downloaded instead.
const LOG = [], MAX = 40;
const push = (kind, msg) => { LOG.push(`${new Date().toISOString().slice(11, 19)} ${kind} ${String(msg).slice(0, 300)}`); if (LOG.length > MAX) LOG.shift(); };
addEventListener('error', e => push('error', `${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`));
addEventListener('unhandledrejection', e => push('promise', e.reason && (e.reason.message || e.reason)));
export const errorLog = () => LOG.slice();

// a small JPEG of the game view (≤ ~300 KB as a data URL)
export function snapshotImage(canvas, render){ try { render && render(); const w = Math.min(960, canvas.width), h = Math.round(canvas.height*w/canvas.width), c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(canvas, 0, 0, w, h); let q = 0.7, url = c.toDataURL('image/jpeg', q); while (url.length > 380000 && q > 0.3) { q -= 0.15; url = c.toDataURL('image/jpeg', q); } return url; } catch (e) { return null; } }
export function deviceInfo(){ const n = navigator; return {ua: n.userAgent, lang: n.language, screen: `${screen.width}x${screen.height}@${devicePixelRatio}`, view: `${innerWidth}x${innerHeight}`, mem: n.deviceMemory || null, cores: n.hardwareConcurrency || null, touch: n.maxTouchPoints || 0}; }

// G: {sb() -> client, canvas(), render(), info() -> game state, feedback: {form, mail}, toast(text, kind), version}
export function initReport(G){
  const back = document.createElement('div'); back.id = 'bugrep'; back.hidden = true;
  back.innerHTML = `<div class="br-box" role="dialog" aria-modal="true" aria-labelledby="br-title"><div class="br-head"><h2 id="br-title">Laporkan bug</h2><button type="button" class="br-x" aria-label="Tutup">×</button></div>
    <div class="br-body"><label>Apa yang terjadi?<textarea maxlength="2000" rows="5" placeholder="Contoh: mobil tembus pembatas saat keluar ramp di KM 23, setelah pindah lajur ke kiri."></textarea></label>
    <label class="br-chk"><input type="checkbox" data-k="shot" checked> Sertakan tangkapan layar game</label><img class="br-img" alt="Tangkapan layar yang akan dikirim">
    <label class="br-chk"><input type="checkbox" data-k="log" checked> Sertakan info perangkat, pengaturan, posisi dan log error</label>
    <div class="br-acts"><button type="button" class="b" data-a="send">Kirim laporan</button><button type="button" class="b alt" data-a="dl">Unduh laporan</button></div>
    <p class="br-msg" role="status"></p><p class="br-note">Punya saran fitur? <a target="_blank" rel="noopener"></a> atau email <a data-mail></a>.</p></div></div>`;
  const css = document.createElement('style'); css.textContent = `#bugrep{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:rgba(10,14,18,.55);padding:16px}#bugrep[hidden]{display:none}
  .br-box{width:min(460px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#f4f1ea;color:#201e1d;border:2px solid #201e1d;font:14px/1.45 var(--font-sans,system-ui,sans-serif)}
  .br-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:2px solid #201e1d}.br-head h2{margin:0;font-size:17px}.br-x{border:0;background:none;font-size:24px;cursor:pointer}
  .br-body{padding:14px 16px;display:flex;flex-direction:column;gap:9px}.br-body label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600}.br-body .br-chk{flex-direction:row;align-items:center;gap:8px;font-weight:400}
  .br-body textarea{font:inherit;padding:8px;border:2px solid #201e1d;resize:vertical}.br-img{width:100%;border:2px solid #201e1d;display:block}.br-acts{display:flex;gap:8px}
  .br-body .b{flex:1;font:inherit;font-weight:700;padding:9px;border:2px solid #201e1d;background:#201e1d;color:#fff;cursor:pointer}.br-body .b.alt{background:#fff;color:#201e1d}.br-body .b:disabled{opacity:.5}
  .br-msg{font-size:12px;margin:0;min-height:1em}.br-note{font-size:12px;opacity:.8;margin:0}.br-note a{color:#ec3013}`;
  document.head.append(css); document.body.append(back);
  const $ = q => back.querySelector(q), msg = t => { $('.br-msg').textContent = t; };
  const fa = back.querySelector('.br-note a'), ma = back.querySelector('[data-mail]'); fa.href = G.feedback.form; fa.textContent = 'Kirim Saran & Kesan'; ma.href = `mailto:${G.feedback.mail}`; ma.textContent = G.feedback.mail;
  let shot = null;
  const close = () => { back.hidden = true; };
  $('.br-x').onclick = close; back.addEventListener('click', e => { if (e.target === back) close(); }); back.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
  $('[data-k=shot]').onchange = e => { $('.br-img').hidden = !e.target.checked; };
  function report(){ const withLog = $('[data-k=log]').checked;
    return {message: $('textarea').value.trim(), info: withLog ? {version: G.version, at: new Date().toISOString(), device: deviceInfo(), game: G.info(), errors: errorLog()} : {version: G.version}, shot: $('[data-k=shot]').checked ? shot : null}; }
  function download(r){ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 1)], {type: 'application/json'})); a.download = `laporan-bug-driving7mit-${Date.now()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  $('[data-a=dl]').onclick = () => { download(report()); msg('Laporan diunduh. Kirim filenya ke ' + G.feedback.mail + '.'); };
  $('[data-a=send]').onclick = async e => { const r = report(); if (r.message.length < 3) { msg('Tuliskan dulu apa yang terjadi.'); return; }
    e.target.disabled = true; msg('Mengirim…');
    try { const sb = await G.sb(); const {data, error} = await sb.rpc('drive7_report', {p_kind: 'bug', p_message: r.message, p_info: r.info, p_shot: r.shot}); if (error || data !== true) throw new Error(error ? error.message : 'ditolak server');
      msg('Terima kasih! Laporan sudah terkirim ke tim driving.7mit.'); G.toast('Laporan bug terkirim'); $('textarea').value = ''; setTimeout(close, 1400); }
    catch (err) { download(r); msg('Gagal mengirim (' + (err.message || err) + '). Laporan diunduh: kirim filenya ke ' + G.feedback.mail + '.'); }
    finally { e.target.disabled = false; } };
  return {open(){ shot = snapshotImage(G.canvas(), G.render); const img = $('.br-img'); img.src = shot || ''; img.hidden = !shot; back.hidden = false; msg(''); setTimeout(() => $('textarea').focus(), 50); }};
}
