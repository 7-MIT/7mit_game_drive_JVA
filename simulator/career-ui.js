// The Garasi & Karier window: vehicles to buy and use, upgrades, the career level, daily missions, achievements and the cloud save.
import {SHOP, PARTS, PART_MAX, missionText, missionPrize, snapshot, restore, newSecret, fmtKey, parseKey, cloudPut, cloudGet} from './career.js';

const TABS = [['garasi', 'Garasi', 'warehouse'], ['karier', 'Karier', 'trophy'], ['misi', 'Misi harian', 'list-checks'], ['simpan', 'Akun & simpan', 'cloud']];
const rpJt = n => n >= 1e6 ? `Rp ${(n/1e6).toLocaleString('id-ID', {maximumFractionDigits: 1})} jt` : `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

// G: {CAR, VEH, cash(), pay(n, why), current(), use(type) -> error text or null, toast(text, kind), sb() -> supabase client (async), icons()}
export function initCareerUI(G){
  const back = el('div', 'dlg-back'); back.id = 'garage'; back.hidden = true;
  back.innerHTML = `<div class="dlg panel gar" role="dialog" aria-labelledby="gar-title"><div class="dlg-head"><h2 id="gar-title">Garasi &amp; Karier</h2><button class="x" id="gar-close" aria-label="Tutup"><i data-lucide="x">×</i></button></div>
    <div class="gar-tabs" role="tablist"></div><div class="dlg-body" id="gar-body"></div></div>`;
  document.body.append(back);
  const css = el('style'); css.textContent = `.gar{max-width:min(720px,calc(100vw - 32px))}.gar-tabs{display:flex;gap:4px;padding:0 14px;flex-wrap:wrap}
  .gar-tabs button{display:inline-flex;gap:6px;align-items:center;padding:6px 10px;border:2px solid var(--color-text);background:var(--color-surface,#fff);font:inherit;font-size:12px;cursor:pointer}
  .gar-tabs button[aria-selected=true]{background:var(--color-text);color:var(--color-surface,#fff)}.gar-tabs svg{width:15px;height:15px}
  .gar-lv{display:flex;gap:12px;align-items:center;margin-bottom:10px}.gar-lv big{font:700 30px/1 var(--font-sans,sans-serif)}.gar-bar{height:8px;border:2px solid var(--color-text);margin:4px 0}
  .gar-bar b{display:block;height:100%;background:var(--color-accent,#ec3013)}.gar-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
  .gar-row button{padding:5px 8px;border:2px solid var(--color-text);background:var(--color-surface,#fff);font:inherit;font-size:11px;cursor:pointer}.gar-row button:disabled{opacity:.4;cursor:default}
  .gar-card{border:2px solid var(--color-text);padding:9px 10px;margin-bottom:8px}.gar-card.on{outline:3px solid var(--color-accent,#ec3013);outline-offset:-5px}
  .gar-card h3{margin:0;font-size:14px;display:flex;justify-content:space-between;gap:8px}.gar-card p{margin:2px 0;font-size:12px;opacity:.8}
  .gar-pips{letter-spacing:2px;color:var(--color-accent,#ec3013)}.gar-ach{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px}
  .gar-ach div{border:2px solid var(--color-text);padding:6px 8px;font-size:12px}.gar-ach div.no{opacity:.45;border-style:dashed}.gar-ach b{display:block;font-size:12px}
  .gar-key{font:700 15px/1.4 ui-monospace,monospace;padding:8px;border:2px dashed var(--color-text);user-select:all;word-break:break-all;margin:6px 0}
  .gar input{font:inherit;padding:6px 8px;border:2px solid var(--color-text);width:100%;box-sizing:border-box}`;
  document.head.append(css);
  const body = back.querySelector('#gar-body'), tabs = back.querySelector('.gar-tabs'); let tab = 'garasi';
  for (const [k, l, ic] of TABS) { const b = el('button', '', `<i data-lucide="${ic}"></i><span>${l}</span>`); b.setAttribute('role', 'tab'); b.dataset.k = k; b.onclick = () => { tab = k; draw(); }; tabs.append(b); }
  back.querySelector('#gar-close').onclick = close; back.addEventListener('click', e => { if (e.target === back) close(); });
  function close(){ back.hidden = true; }
  function open(t){ if (t) tab = t; back.hidden = false; draw(); }
  const {CAR} = G;

  function garage(){ const cur = G.current(), cash = G.cash();
    body.append(el('p', 'help', `Uang tunai ${rpJt(cash)}. Kendaraan pekerjaan (taksi, bus, angkot, truk) boleh dipakai sebagai kendaraan perusahaan saat bekerja walau belum dibeli.`));
    for (const [t, s] of Object.entries(G.VEH)) { const own = CAR.owns(t), shop = SHOP[t] || {price: 0}, up = CAR.upOf(t), c = el('div', 'gar-card' + (t === cur ? ' on' : ''));
      const pips = Object.entries(PARTS).map(([k, p]) => `${p.name} <span class="gar-pips">${'■'.repeat(up[k] || 0)}${'□'.repeat(PART_MAX - (up[k] || 0))}</span>`).join(' · ');
      c.innerHTML = `<h3><span>${esc(s.label)} <small>${esc(s.gol)}</small></span><span>${own ? (t === cur ? 'Dipakai' : 'Milik Anda') : rpJt(shop.price)}</span></h3><p>${Math.round(s.vmax*3.6*CAR.boost(t).vmax)} km/j maks${t === 'bicycle' ? '' : ' · ' + pips}</p>`;
      const row = el('div', 'gar-row');
      if (own) { const u = el('button', '', t === cur ? 'Sedang dipakai' : 'Pakai'); u.disabled = t === cur; u.onclick = () => { const e = G.use(t); if (e) G.toast(e, 'warn'); else draw(); }; row.append(u);
        if (t !== 'bicycle') for (const [k, p] of Object.entries(PARTS)) { const lv = up[k] || 0, b = el('button', '', lv >= PART_MAX ? `${p.name} maks` : `${p.name} +1 · ${rpJt(p.price[lv])}`); b.title = p.desc; b.disabled = lv >= PART_MAX;
          b.onclick = () => { const r = CAR.upgrade(t, k, G.cash()); if (!r.ok) return G.toast(r.why, 'warn'); G.pay(r.price, `Upgrade ${p.name.toLowerCase()} ${s.label} ke tingkat ${r.lvl}`); G.toast(`${p.name} ${s.label} tingkat ${r.lvl}`); G.refresh && G.refresh(t); draw(); }; row.append(b); } }
      else { const why = CAR.canBuy(t), b = el('button', '', why && why !== 'Uang tunai tidak cukup' ? why : `Beli ${rpJt(shop.price)}`); b.disabled = !!why || cash < shop.price;
        b.onclick = () => { const r = CAR.buy(t, G.cash()); if (!r.ok) return G.toast(r.why, 'warn'); G.pay(r.price, `Beli ${s.label}`); G.toast(`${s.label} masuk garasi`); draw(); }; row.append(b); }
      c.append(row); body.append(c); } }

  function career(){ const L = CAR.lvl(), T = CAR.S.tot, r = CAR.rating();
    body.append(el('div', 'gar-lv', `<big>${L.lvl}</big><div style="flex:1"><b>${L.title}</b><div class="gar-bar"><b style="width:${Math.round(L.k*100)}%"></b></div><small>${L.xp.toLocaleString('id-ID')} XP${L.next ? ' · level berikutnya ' + L.next.toLocaleString('id-ID') : ' · level tertinggi'}</small></div>`));
    body.append(el('p', '', `Rating pengemudi <b>${r ? r.toFixed(2).replace('.', ',') + ' ★' : 'belum ada'}</b> · ${Math.round(T.km).toLocaleString('id-ID')} km · ${T.jobs} order selesai · ${T.tolls} gerbang tol · rekor tanpa pelanggaran ${T.cleanBest.toFixed(1).replace('.', ',')} km`));
    const g = el('div', 'gar-ach'); for (const a of CAR.achList()) g.append(el('div', a.at ? '' : 'no', `<b>${a.at ? '🏆 ' : ''}${esc(a.t)}</b>${esc(a.how)}`));
    body.append(el('h3', '', 'Pencapaian'), g); }

  function missions(){ const d = CAR.daily();
    body.append(el('p', 'help', 'Tiga misi baru setiap hari (sama untuk semua pemain). Hadiah langsung masuk ke uang tunai.'));
    for (const m of d) { const pz = missionPrize(m), c = el('div', 'gar-card');
      c.innerHTML = `<h3><span>${m.done ? '✓ ' : ''}${esc(missionText(m))}</span><span>${rpJt(pz.cash)} · ${pz.xp} XP</span></h3><div class="gar-bar"><b style="width:${Math.round(Math.min(1, m.p/m.n)*100)}%"></b></div><p>${m.done ? 'Selesai' : `${(Math.round(m.p*10)/10).toLocaleString('id-ID')} / ${m.n}`}</p>`;
      body.append(c); } }

  function cloud(){ let key = null; try { key = parseKey(localStorage.getItem('drive7_savekey')); } catch (e) {}
    // the account is the main way: progress syncs on its own; the save key below is for playing without an account
    if (G.account) { const u = G.user && G.user(), c = el('div', 'gar-card'); c.innerHTML = u ? `<h3><span>Akun: ${esc(G.userName())}</span><span>Sinkron otomatis</span></h3><p>${esc(u.email || '')} · progres tersimpan ke akun secara otomatis.</p>` : '<h3><span>Belum masuk akun</span></h3><p>Masuk atau daftar (email atau Google) agar semua progres tersimpan ke akun dan bisa bermain multiplayer.</p>';
      const r = el('div', 'gar-row'), b = el('button', '', u ? 'Kelola akun' : 'Masuk / Daftar'); b.onclick = () => G.account(); r.append(b); c.append(r); body.append(c, el('h3', '', 'Kunci simpanan (tanpa akun)')); }
    body.append(el('p', 'help', 'Simpan uang, garasi, karier, pengaturan dan riwayat ke server driving.7mit, lalu lanjutkan di HP atau komputer lain dengan kunci simpanan. Simpan kunci di tempat aman: siapa pun yang tahu kunci ini bisa memuat dan menimpa simpanan Anda.'));
    if (key) body.append(el('div', 'gar-key', fmtKey(key.code, key.secret)));
    const row = el('div', 'gar-row'), msg = el('p', 'help'), sv = el('button', '', key ? 'Simpan sekarang' : 'Buat simpanan cloud');
    sv.onclick = async () => { sv.disabled = true; msg.textContent = 'Menyimpan…';
      try { G.flush && G.flush(); const k = key || {code: null, secret: newSecret()}; const code = await cloudPut(await G.sb(), k, snapshot(localStorage));
        const nk = {code, secret: k.secret}; localStorage.setItem('drive7_savekey', fmtKey(nk.code, nk.secret)); msg.textContent = `Tersimpan ${new Date().toLocaleTimeString('id-ID')}`; G.toast('Simpanan cloud diperbarui'); draw(); }
      catch (e) { msg.textContent = 'Gagal menyimpan: ' + (e.message || e); sv.disabled = false; } };
    row.append(sv);
    if (key) { const cp = el('button', '', 'Salin kunci'); cp.onclick = () => { navigator.clipboard?.writeText(fmtKey(key.code, key.secret)).then(() => G.toast('Kunci disalin'), () => {}); }; row.append(cp); }
    body.append(row, msg, el('h3', '', 'Muat dari kunci simpanan'));
    const inp = el('input'); inp.placeholder = 'XXXXXXXX-XXXXXXXXXXXXXXXXXXXX'; inp.autocomplete = 'off'; inp.spellcheck = false;
    const ld = el('button', '', 'Muat & mulai ulang'), r2 = el('div', 'gar-row'); r2.append(ld);
    ld.onclick = async () => { const k = parseKey(inp.value); if (!k) { msg.textContent = 'Format kunci salah'; return; }
      if (!confirm('Progres di perangkat ini akan diganti dengan simpanan cloud. Lanjutkan?')) return; ld.disabled = true; msg.textContent = 'Memuat…';
      try { const r = await cloudGet(await G.sb(), k); G.beforeRestore && G.beforeRestore(); const n = restore(localStorage, r.data); localStorage.setItem('drive7_savekey', fmtKey(k.code, k.secret));
        msg.textContent = `${n} data dimuat, memulai ulang…`; setTimeout(() => location.reload(), 600); }
      catch (e) { msg.textContent = 'Gagal memuat: ' + (e.message || e); ld.disabled = false; } };
    body.append(inp, r2); }

  function draw(){ body.innerHTML = ''; for (const b of tabs.children) b.setAttribute('aria-selected', b.dataset.k === tab ? 'true' : 'false');
    ({garasi: garage, karier: career, misi: missions, simpan: cloud})[tab](); G.icons && G.icons(); }
  return {open, close, draw, get on(){ return !back.hidden; }, toggle(t){ if (back.hidden) open(t); else close(); }};
}
