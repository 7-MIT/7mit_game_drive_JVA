// Account progress through the page the game is embedded in (Wayyuh): when driving.7mit runs inside that page's iframe,
// it asks the parent for the saved progress ("wayyuh:load") and sends it back whenever it changes ("wayyuh:save").
// The saved state carries a short summary (level, score, cash) and the full save (career.js snapshot of the tj_* keys).
// Outside an embed (no parent window) nothing happens. Only messages from window.parent are read.
import {snapshot, restore} from './career.js';

const STAMP = 'drive7_wayyuh_t';          // when this device last took or sent the account's progress
// the summary (level, score, cash) comes from the game once it runs (main.js); until then only the full save is sent
let summaryFn = () => ({});
export const setWayyuhSummary = f => { summaryFn = f; };
let started = null;
// called by startup.js as the page opens (main.js loads only when the player presses play), so newer account progress
// is in place before the game reads its save
export function initWayyuh({log = () => {}} = {}){ if (started) return started;
  if (typeof window === 'undefined' || window.parent === window) return null;
  const parent = window.parent; let n = 0, lastSent = '', loaded = false;
  const post = msg => { try { parent.postMessage(msg, '*'); } catch (e) {} };
  const stamp = () => Number(localStorage.getItem(STAMP) || 0);
  window.addEventListener('message', event => {
    if (event.source !== window.parent) return;
    const result = event.data; if (!result || result.type !== 'wayyuh:result') return;
    if (result.error) { log('Wayyuh: ' + result.error); return; }
    if (result.requestId === 'load') { loaded = true; const st = result.state;
      // the account's progress is newer than this device's: take it, then start again with it (once per tab)
      if (st && st.save && st.save.ls && (st.t || 0) > stamp() && !sessionStorage.getItem('drive7_wayyuh_restored')) {
        const k = restore(localStorage, st.save); localStorage.setItem(STAMP, String(st.t)); sessionStorage.setItem('drive7_wayyuh_restored', '1');
        log(`Wayyuh: progres akun dimuat (${k} data)`); if (k) location.reload(); } } });
  post({type: 'wayyuh:load', requestId: 'load'});
  // after the state changes: the summary and the full save, at most every 15 s, and when the tab is hidden or closed
  function save(force = false){ if (!loaded && !force) return;
    let state; try { let sm = {}; try { sm = summaryFn() || {}; } catch (e) {} state = {...sm, t: Date.now(), save: snapshot(localStorage)}; } catch (e) { return; }
    const sig = JSON.stringify({...state, t: 0, save: state.save.ls}); if (sig === lastSent) return; lastSent = sig;
    localStorage.setItem(STAMP, String(state.t)); post({type: 'wayyuh:save', requestId: 'save-' + (++n), state}); }
  setInterval(save, 15000);
  addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
  addEventListener('pagehide', () => save(true));
  started = {save}; return started; }
