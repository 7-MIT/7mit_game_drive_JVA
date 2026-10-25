// All the game's speech goes through here: navigation, the radio announcer and the emergency dispatchers.
// 1. a fixed line with a ready clip (voice-data branch, made by tools/voice-build.py with Piper) is played as it is;
// 2. any other line is synthesised on the device by Piper in a worker (piper-worker.js), the same Indonesian voice;
// 3. until the voice model is in (or on a device too weak to run it, or with "Suara bawaan perangkat" chosen) the browser's own voice speaks.
// Lines are queued per channel so they never talk over each other; the phone channel sounds like a phone line.
import {hashText, normText} from './voice-lines.js';
export const VOICE_BASE = 'https://raw.githubusercontent.com/7-MIT/7mit_game_drive_jva/voice-data/';
let ctx = null, index = null, indexP = null, worker = null, workerReady = false, workerFailed = false, seq = 0;
const pending = new Map(), cache = new Map(), queue = [], state = {busy: false, cur: null};
const opts = {engine: 'auto', strong: true, cacheMax: 80, onState: () => {}};
export function configure(o){ Object.assign(opts, o); if (opts.engine === 'browser' && worker) { worker.terminate(); worker = null; workerReady = false; } }
const audio = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; };
function loadIndex(){ if (!indexP) indexP = fetch(VOICE_BASE + 'index.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { index = j; return j; }).catch(() => null); return indexP; }
const piperOK = () => opts.engine !== 'browser' && !workerFailed && opts.strong && typeof Worker !== 'undefined';
function startWorker(){
  if (worker || !piperOK()) return; loadIndex().then(ix => { if (!ix || worker || !piperOK()) return;
    try { worker = new Worker(new URL('./piper-worker.js', import.meta.url)); } catch (e) { workerFailed = true; return; }
    worker.onmessage = e => { const m = e.data;
      if (m.type === 'ready') { workerReady = true; opts.onState('piper'); }
      else if (m.type === 'audio') { const p = pending.get(m.id); pending.delete(m.id); if (p) p.res(m); }
      else if (m.type === 'error') { if (m.id == null) { workerFailed = true; worker.terminate(); worker = null; opts.onState('browser'); } const p = pending.get(m.id); pending.delete(m.id); if (p) p.rej(new Error(m.message)); } };
    worker.postMessage({type: 'init', model: VOICE_BASE + ix.model}); }); }
// the audio for a line: a clip, or Piper on the device, as an AudioBuffer; null when only the browser voice can say it
async function bufferFor(text){
  const key = normText(text); if (cache.has(key)) return cache.get(key); const c = audio(); if (!c) return null;
  const ix = await loadIndex(), clip = ix && ix.clips && ix.clips[hashText(key)];
  let buf = null;
  if (clip) { try { const r = await fetch(VOICE_BASE + clip.file); buf = await c.decodeAudioData(await r.arrayBuffer()); } catch (e) { buf = null; } }
  if (!buf && workerReady) { try { const id = ++seq, m = await new Promise((res, rej) => { pending.set(id, {res, rej}); worker.postMessage({type: 'say', id, text: key}); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout')); } }, 15000); });
      buf = c.createBuffer(1, m.pcm.length, m.rate); buf.copyToChannel(m.pcm, 0); } catch (e) { buf = null; } }
  if (buf) { cache.set(key, buf); while (cache.size > opts.cacheMax) cache.delete(cache.keys().next().value); }
  return buf; }
function playBuffer(buf, channel, gain){ return new Promise(done => { const c = audio(); const src = c.createBufferSource(); src.buffer = buf; let node = src;
  if (channel === 'phone') { const hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), sh = c.createWaveShaper(); hp.type = 'highpass'; hp.frequency.value = 320; lp.type = 'lowpass'; lp.frequency.value = 3300;
    const k = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i/128 - 1; k[i] = Math.tanh(x*1.6); } sh.curve = k; node.connect(hp); hp.connect(lp); lp.connect(sh); node = sh; }
  const g = c.createGain(); g.gain.value = gain; node.connect(g); g.connect(c.destination); state.cur = {stop: () => { try { src.stop(); } catch (e) {} }};
  src.onended = () => { state.cur = null; done(); }; src.start(); }); }
function browserSay(text, channel){ return new Promise(done => { if (!('speechSynthesis' in window)) return done(); try { const ss = speechSynthesis, u = new SpeechSynthesisUtterance(text), vs = ss.getVoices();
  const v = vs.find(x => /^id(-|_|$)/i.test(x.lang) && /google|natural|neural|online/i.test(x.name)) || vs.find(x => /^id(-|_|$)/i.test(x.lang)) || vs.find(x => /^ms(-|_|$)/i.test(x.lang));
  u.lang = v ? v.lang : 'id-ID'; if (v) u.voice = v; u.rate = channel === 'phone' ? 1.05 : 1.02; u.pitch = channel === 'radio' ? 0.95 : 1; u.onend = u.onerror = () => done(); state.cur = {stop: () => ss.cancel()}; ss.speak(u);
  setTimeout(done, 4000 + text.length*120); } catch (e) { done(); } }); }
async function pump(){
  if (state.busy) return; const item = queue.shift(); if (!item) return; state.busy = true; state.channel = item.channel;
  // navigation must be on time: if Piper is not done within 1.5 s the browser voice says it (the Piper audio is still cached for next time)
  try { const buf = item.channel === 'nav' ? await Promise.race([bufferFor(item.text), new Promise(r => setTimeout(() => r(null), 1500))]) : await bufferFor(item.text); if (item.stale && item.stale()) {} else if (buf) await playBuffer(buf, item.channel, item.gain); else await browserSay(item.text, item.channel); }
  catch (e) {} finally { state.busy = false; item.done && item.done(); pump(); } }
// say(text, {channel: 'nav' | 'radio' | 'phone', urgent, gain}) → resolves when it has been said
export function say(text, {channel = 'nav', urgent = false, gain = 1, stale = null} = {}){
  if (!text) return Promise.resolve(); startWorker();
  if (urgent) { for (let i = queue.length - 1; i >= 0; i--) if (queue[i].channel === channel) { const q = queue.splice(i, 1)[0]; q.done && q.done(); } if (state.cur && state.channel === channel) state.cur.stop(); }
  else if (channel === 'nav' && queue.filter(q => q.channel === 'nav').length >= 2) return Promise.resolve();
  return new Promise(done => { queue.push({text, channel, gain, stale, done}); pump(); }); }
export function stopChannel(channel){ for (let i = queue.length - 1; i >= 0; i--) if (queue[i].channel === channel) { const q = queue.splice(i, 1)[0]; q.done && q.done(); } if (state.cur) state.cur.stop(); }
// warm up: fetch the clip list early and start loading the model on devices that can run it
export function prepare(){ loadIndex(); startWorker(); }
export const status = () => workerReady ? 'piper' : worker ? 'loading' : 'browser';
