// Player accounts for driving.7mit: sign up / sign in with email and password or with Google, and keep the player's progress
// (money, garage, career, settings, history) in their account (table drive7_profiles, one row per account, readable only by its owner).
// The same signed-in client is used by multiplayer, which needs an account.
import {snapshot, restore} from './career.js';

const URL_ = 'https://lajzrempjyoqkubkumhb.supabase.co', KEY = 'sb_publishable_yGZ90Bkv3yreqc9pA55bpw_YKKBhWRw';
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const SYNC = 'drive7_sync', EVERY = 90000;
let sbP = null, user = null, ready = null, timer = 0, busy = false, dlg = null, after = null;
const hooks = {beforeRestore: () => {}, flush: () => {}, signedIn: () => {}, toast: t => {}};
const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const readSync = () => { try { return JSON.parse(ls.getItem(SYNC) || 'null'); } catch (e) { return null; } };

export function client(){
  if (!sbP) sbP = import(LIB).then(({createClient}) => createClient(URL_, KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'drive7-auth'},
    realtime: {params: {eventsPerSecond: 20}}}));
  return sbP; }
export const currentUser = () => user;
export const displayName = (u = user) => !u ? '' : String(u.user_metadata?.full_name || u.user_metadata?.name || (u.email || '').split('@')[0] || 'Pemain').replace(/[^\w .\-]/g, '').slice(0, 16).trim() || 'Pemain';
export function setHooks(h){ Object.assign(hooks, h); }

// start: restore the session (and finish a Google sign-in coming back to the page); resolves to the user or null
export function init(){
  if (ready) return ready;
  const back = /[?&]code=|access_token=/.test(location.search + location.hash), had = ls && ls.getItem('drive7-auth');
  if (!back && !had) { ready = Promise.resolve(null); return ready; }          // never signed in here: no need to load anything yet
  ready = boot(); return ready; }
async function boot(){
  try { const sb = await client(); const {data} = await sb.auth.getSession(); user = data.session?.user || null;
    sb.auth.onAuthStateChange((ev, s) => { const was = user; user = s?.user || null; if (user && (!was || was.id !== user.id)) onSignIn(); if (!user) stopSync(); refresh(); });
    if (/[?&]code=/.test(location.search)) { const u = new URL(location.href); u.searchParams.delete('code'); u.searchParams.delete('state'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
    if (user) onSignIn(); return user; }
  catch (e) { return null; } }
export async function signedIn(){ if (!ready) init(); await ready; if (user) return user; try { const sb = await client(); const {data} = await sb.auth.getSession(); user = data.session?.user || null; } catch (e) {} return user; }

// ---- progress in the account ----
async function onSignIn(){ hooks.signedIn(user); await syncNow(true); startSync(); }
function startSync(){ stopSync(); timer = setInterval(() => syncNow(false), EVERY); addEventListener('visibilitychange', hidden); }
function stopSync(){ clearInterval(timer); timer = 0; removeEventListener('visibilitychange', hidden); }
function hidden(){ if (document.visibilityState === 'hidden') syncNow(false); }
async function pull(sb){ const {data, error} = await sb.from('drive7_profiles').select('data, updated_at').eq('user_id', user.id).maybeSingle(); if (error) throw error; return data; }
async function push(sb){ hooks.flush(); const snap = snapshot(ls), t = new Date().toISOString();
  const {error} = await sb.from('drive7_profiles').upsert({user_id: user.id, name: displayName(), data: snap, updated_at: t}); if (error) throw error;
  ls.setItem(SYNC, JSON.stringify({uid: user.id, t})); return t; }
// first = just signed in: when the account holds newer progress than this device last saw, load it (asking when this device has
// progress of its own from another account or from before signing in); otherwise this device's progress goes up
export async function syncNow(first){
  if (!user || busy || !ls) return; busy = true;
  try { const sb = await client(), mark = readSync(), row = await pull(sb), mine = mark && mark.uid === user.id;
    if (row && row.data && row.data.ls && (!mine || new Date(row.updated_at) > new Date(mark.t))) {
      const localHas = !!ls.getItem('tj_cfg1');
      if (!first || mine || !localHas || confirm('Akun ini sudah punya progres tersimpan. Muat progres akun? (OK = muat progres akun, Batal = pakai progres di perangkat ini dan simpan ke akun)')) {
        hooks.beforeRestore(); restore(ls, row.data); ls.setItem(SYNC, JSON.stringify({uid: user.id, t: row.updated_at})); hooks.toast('Progres dari akun dimuat'); setTimeout(() => location.reload(), 500); return; } }
    await push(sb); refresh(); }
  catch (e) { if (first) hooks.toast('Sinkron akun gagal: ' + (e.message || e)); }
  finally { busy = false; } }

// ---- the account window ----
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const G_ICON = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function build(){
  const back = document.createElement('div'); back.id = 'acct'; back.hidden = true;
  back.innerHTML = `<div class="acct-box" role="dialog" aria-modal="true" aria-labelledby="acct-title"><div class="acct-head"><h2 id="acct-title">Akun driving.7mit</h2><button type="button" class="acct-x" aria-label="Tutup">×</button></div><div class="acct-body"></div></div>`;
  const css = document.createElement('style'); css.textContent = `#acct{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:rgba(10,14,18,.55);padding:16px}#acct[hidden]{display:none}
  .acct-box{width:min(420px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#f4f1ea;color:#201e1d;border:2px solid #201e1d;font:14px/1.45 var(--font-sans,system-ui,sans-serif)}
  .acct-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:2px solid #201e1d}.acct-head h2{margin:0;font-size:17px}.acct-x{border:0;background:none;font-size:24px;cursor:pointer;color:inherit}
  .acct-body{padding:14px 16px;display:flex;flex-direction:column;gap:9px}.acct-body label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:600}
  .acct-body input{font:inherit;padding:8px 10px;border:2px solid #201e1d;background:#fff;color:#201e1d}.acct-body button.b{font:inherit;font-weight:700;padding:9px 12px;border:2px solid #201e1d;background:#201e1d;color:#fff;cursor:pointer;display:flex;gap:8px;align-items:center;justify-content:center}
  .acct-body button.b.alt{background:#fff;color:#201e1d}.acct-body button.b:disabled{opacity:.5;cursor:default}.acct-body .l{border:0;background:none;color:#ec3013;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;padding:0;align-self:flex-start}
  .acct-msg{font-size:12px;min-height:1em}.acct-msg.bad{color:#b3200c}.acct-note{font-size:12px;opacity:.75;margin:0}.acct-or{display:flex;align-items:center;gap:8px;font-size:11px;opacity:.6}.acct-or:before,.acct-or:after{content:'';flex:1;border-top:1px solid currentColor}
  .acct-tabs{display:flex;gap:4px}.acct-tabs button{flex:1;font:inherit;font-size:13px;padding:6px;border:2px solid #201e1d;background:#fff;cursor:pointer}.acct-tabs button[aria-pressed=true]{background:#201e1d;color:#fff}`;
  document.head.append(css); document.body.append(back);
  back.querySelector('.acct-x').onclick = close; back.addEventListener('click', e => { if (e.target === back) close(); }); back.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
  return back; }
let mode = 'in', note = '';
function close(){ if (dlg) dlg.hidden = true; after = null; }
export function open(message = '', onSignedIn = null){ if (!dlg) dlg = build(); note = message; after = onSignedIn; dlg.hidden = false; init(); refresh(); }
function refresh(){
  if (!dlg || dlg.hidden) return; const b = dlg.querySelector('.acct-body'); b.innerHTML = '';
  if (user) { const m = readSync();
    b.innerHTML = `<p>Masuk sebagai <b>${esc(displayName())}</b><br><small>${esc(user.email || '')}</small></p><p class="acct-note">Progres (uang, garasi, karier, pengaturan, riwayat) tersimpan otomatis ke akun setiap 1,5 menit dan saat game ditutup. Masuk dengan akun yang sama di perangkat lain untuk melanjutkan.${m && m.uid === user.id ? `<br>Terakhir tersimpan: ${esc(new Date(m.t).toLocaleString('id-ID'))}` : ''}</p>
      <button class="b" data-a="sync">Simpan sekarang</button><button class="b alt" data-a="out">Keluar dari akun</button><p class="acct-msg"></p>`;
    b.querySelector('[data-a=sync]').onclick = async e => { e.target.disabled = true; await syncNow(false); e.target.disabled = false; refresh(); hooks.toast('Progres tersimpan ke akun'); };
    b.querySelector('[data-a=out]').onclick = async () => { await syncNow(false); const sb = await client(); await sb.auth.signOut(); user = null; stopSync(); refresh(); hooks.toast('Keluar dari akun'); };
    return; }
  b.innerHTML = `${note ? `<p class="acct-msg bad">${esc(note)}</p>` : ''}<p class="acct-note">Buat akun untuk menyimpan semua progres driving.7mit ke server dan bermain multiplayer.</p>
    <button class="b alt" data-a="google">${G_ICON}<span>Masuk dengan Google</span></button><div class="acct-or">atau dengan email</div>
    <div class="acct-tabs"><button data-m="in" aria-pressed="${mode === 'in'}">Masuk</button><button data-m="up" aria-pressed="${mode === 'up'}">Daftar</button></div>
    ${mode === 'up' ? '<label>Nama pemain<input data-f="name" maxlength="16" autocomplete="nickname"></label>' : ''}
    <label>Email<input data-f="email" type="email" autocomplete="email" required></label>
    ${mode === 'reset' ? '' : `<label>Kata sandi<input data-f="pw" type="password" minlength="6" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}"></label>`}
    <button class="b" data-a="go">${mode === 'up' ? 'Buat akun' : mode === 'reset' ? 'Kirim tautan atur ulang' : 'Masuk'}</button>
    ${mode === 'in' ? '<button class="l" data-a="forgot">Lupa kata sandi?</button>' : ''}<p class="acct-msg" role="status"></p>`;
  const msg = (t, bad) => { const m = b.querySelector('.acct-msg:last-child'); m.textContent = t; m.className = 'acct-msg' + (bad ? ' bad' : ''); };
  for (const t of b.querySelectorAll('[data-m]')) t.onclick = () => { mode = t.dataset.m; refresh(); };
  const fg = b.querySelector('[data-a=forgot]'); if (fg) fg.onclick = () => { mode = 'reset'; refresh(); };
  b.querySelector('[data-a=google]').onclick = async () => { try { const sb = await client(); await sb.auth.signInWithOAuth({provider: 'google', options: {redirectTo: location.origin + location.pathname}}); } catch (e) { msg('Gagal: ' + (e.message || e), true); } };
  b.querySelector('[data-a=go]').onclick = async e => { const v = k => (b.querySelector(`[data-f=${k}]`) || {}).value || '', email = v('email').trim(), pw = v('pw');
    if (!/^\S+@\S+\.\S+$/.test(email)) return msg('Email tidak valid', true); if (mode !== 'reset' && pw.length < 6) return msg('Kata sandi minimal 6 karakter', true);
    e.target.disabled = true; msg('Sebentar…');
    try { const sb = await client(); let r;
      if (mode === 'up') { const name = v('name').replace(/[^\w .\-]/g, '').slice(0, 16).trim(); r = await sb.auth.signUp({email, password: pw, options: {data: {full_name: name || email.split('@')[0]}, emailRedirectTo: location.origin + location.pathname}});
        if (!r.error && !r.data.session) { msg('Akun dibuat. Buka email untuk konfirmasi, lalu masuk.'); e.target.disabled = false; mode = 'in'; return; } }
      else if (mode === 'reset') { r = await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname}); if (!r.error) { msg('Tautan atur ulang sudah dikirim ke email.'); e.target.disabled = false; return; } }
      else r = await sb.auth.signInWithPassword({email, password: pw});
      if (r.error) throw r.error; user = r.data.user || r.data.session?.user || user; if (!ready || !timer) ready = boot();
      const cb = after; close(); hooks.toast(`Masuk sebagai ${displayName()}`); if (cb) cb(user); }
    catch (err) { const t = String(err.message || err); msg(/Invalid login/i.test(t) ? 'Email atau kata sandi salah' : /already registered/i.test(t) ? 'Email sudah terdaftar: pilih Masuk' : /not confirmed/i.test(t) ? 'Email belum dikonfirmasi: cek kotak masuk email' : 'Gagal: ' + t, true); e.target.disabled = false; } };
}
// after a Google sign-in the page comes back with the session: run the pending action (e.g. multiplayer) once the game is ready
export function pending(){ try { const p = sessionStorage.getItem('drive7_after'); sessionStorage.removeItem('drive7_after'); return p; } catch (e) { return null; } }
export function remember(action){ try { sessionStorage.setItem('drive7_after', action); } catch (e) {} }
export function refreshUI(){ refresh(); }
