// In-car radio "7MIT FM 97,7": a light synthesised music bed, a station jingle, and a fictional announcer (the game voice, voice.js)
// who reads the time, the weather, the traffic where you are and fictional ads. Everything here is made up for the game.
import {STATION, STATION_ID, ADS, TIPS, RADIO_NO} from './voice-lines.js';
import * as VOX from './voice.js';
export {STATION, ADS, TIPS, RADIO_NO};
// The station plays songs from YouTube, in Indonesian, Javanese and English. Listeners cannot pick the next song from a menu:
// the only way is to ring the request line (RADIO_NO) and send a song, which then queues behind everyone else's requests.
// The station's own songs are fixed [video id, label] pairs (each checked to be embeddable), so the first song can start the instant the radio
// is switched on, inside the tap or key press: phones and tablets refuse to autoplay a video that was not started by the player's own gesture.
export const TRACKS = [
  ['9II3OGZETo4', 'Tulus Hati-Hati di Jalan'],
  ['RYGgSRtYxd0', 'Dewa 19 Kangen'],
  ['dGcGbF4ex5o', 'Sheila on 7 Dan'],
  ['b0ZBBjViV8Y', 'NOAH Separuh Aku'],
  ['SHj2kJzVi_g', 'Raisa Kali Kedua'],
  ['oIYWenB637c', 'Pamungkas To The Bone'],
  ['lB8ASupNtlw', 'Hindia Everything u are'],
  ['ba-XAIskH_g', 'Juicy Luicy Lantas'],
  ['HyhLsy6b0XI', 'Nadin Amizah Bertaut'],
  ['QSWYyoF79oE', 'Mahalini Sial'],
  ['jzxCaNGJcPE', 'Lyodra Sang Dewi'],
  ['FcOctsNXyjk', 'Andmesh Cinta Luar Biasa'],
  ['WlmWXoP0C0s', 'Denny Caknan Kartonyono Medot Janji'],
  ['_1UlylSfSTk', 'Guyon Waton Pesan Terakhir'],
  ['E3dZs0kJ4w4', 'Happy Asmara Tak Ikhlasno'],
  ['zOUkeXEEHvo', 'Didi Kempot Stasiun Balapan'],
  ['0ADwyqBL5ds', 'Didi Kempot Cidro'],
  ['3TQu9MClbcM', 'Guyon Waton Lungset'],
  ['6n8PQ3ERdGk', 'Ndarboy Genk Kimcil Kepolen'],
  ['Bl9mcrJ-GG4', 'Woro Widowati Mendung Tanpo Udan'],
  ['SG1yc8yLwWs', 'Tri Suaka Prasasti Cintamu'],
  ['fKVgm3_x-OI', 'Denny Caknan Satru'],
  ['1vrEljMfXYo', 'John Denver Take Me Home Country Roads'],
  ['dvgZkm1xWPE', 'Coldplay Viva La Vida'],
  ['2Vv-BfVoq4g', 'Ed Sheeran Perfect'],
  ['LjhCEhWiKXk', 'Bruno Mars Just The Way You Are'],
  ['hLQl3WQQoQ0', 'Adele Someone Like You'],
  ['7wtfhZwyrcc', 'Imagine Dragons Believer'],
  ['HgzGwKwLmgM', 'Queen Dont Stop Me Now'],
  ['1k8craCGpgs', 'Journey Dont Stop Believin'],
  ['lDK9QqIzhwk', 'Bon Jovi Livin on a Prayer'],
  ['4NRXx6U8ABQ', 'The Weeknd Blinding Lights'],
  ['S2Cti12XBw4', 'Maroon 5 Sunday Morning'],
  ['O1-4u9W-bns', 'Jason Mraz I Wont Give Up']];
export const PLAYLIST = TRACKS.map(t => t[1]);
export const shuffled = (a, rnd = Math.random) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd()*(i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// the request queue, shared by every player: a request carries a unique rid and its time, so each player's copy sorts the same way
export const VID = /^[\w-]{11}$/;
export function createRequests({max = 20, perUser = 3} = {}){ const q = [];
  return {
    add(r){ if (!r || !VID.test(String(r.id))) return {ok: false, why: 'bad'}; const by = String(r.by || 'Pemain').slice(0, 24), title = String(r.title || 'Lagu pilihan').slice(0, 90), rid = String(r.rid || r.id + ':' + r.t).slice(0, 40);
      if (q.some(x => x.rid === rid)) return {ok: false, why: 'dup'}; if (q.length >= max) return {ok: false, why: 'full'}; if (q.filter(x => x.by === by).length >= perUser) return {ok: false, why: 'user'};
      const it = {rid, id: r.id, title, by, t: Number.isFinite(+r.t) ? +r.t : Date.now()}; q.push(it); q.sort((a, b) => a.t - b.t || (a.rid < b.rid ? -1 : 1)); return {ok: true, pos: q.indexOf(it) + 1, item: it}; },
    shift(){ return q.shift(); }, list(){ return q.slice(); }, get length(){ return q.length; } }; }
const pick = a => a[Math.floor(Math.random()*a.length)];
const hhmm = h => `${String(Math.floor(h)).padStart(2, '0')}.${String(Math.floor((h % 1)*60)).padStart(2, '0')}`;
// what the announcer says next: rotates through station id, time & weather, traffic, an ad and a tip
export function segment(n, S){ const k = n % 5;
  if (k === 0) return STATION_ID;
  if (k === 1) return `Sekarang pukul ${hhmm(S.hour)}. Cuaca di sekitar ${S.place || 'lokasi Anda'} ${S.weather}. ${S.rain ? 'Hati-hati, jalanan licin.' : 'Selamat menikmati perjalanan.'}`;
  if (k === 2) return S.jam > 6 ? `Info lalu lintas: arus di ${S.road || 'ruas ini'} terpantau padat merayap. Sabar ya, tetap di lajur Anda.` : `Info lalu lintas: arus di ${S.road || 'ruas ini'} terpantau lancar. Tetap patuhi batas kecepatan.`;
  if (k === 3) return pick(ADS);
  return pick(TIPS); }

export function createRadio({ctx, out, state, yt, onNow = () => {}, onQueue = () => {}}){
  // yt: {find(query) → Promise<[{id, title}]>, play(id), stop(), volume(0-100)}; main.js feeds the player's state back through radio.player(code)
  // music bed: a slow four-chord loop on soft pads with a little pulse; it only plays while no song is on (no internet, nothing found yet)
  const g = ctx.createGain(); g.gain.value = 0; g.connect(out); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; f.connect(g);
  const CH = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]];
  let on = false, beat = 0, timer = 0, retry = 0, n = 0, k = 0, speaking = false, busy = false, cur = null, watch = 0, last = null, pi = 0;
  const req = createRequests(), order = shuffled(TRACKS);
  function note(fr, t, d, type = 'triangle', gain = 0.05){ const o = ctx.createOscillator(), e = ctx.createGain(); o.type = type; o.frequency.value = fr; e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(gain, t + 0.08); e.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(e); e.connect(f); o.start(t); o.stop(t + d + 0.05); }
  function bar(){ const t = ctx.currentTime + 0.05, c = CH[beat % 4]; beat++; for (const fr of c) note(fr, t, 2.3, 'sine', 0.035); note(c[0]/2, t, 0.5, 'triangle', 0.07); note(c[0]/2, t + 1.2, 0.5, 'triangle', 0.05);
    for (let i = 0; i < 4; i++) note(c[(i + beat) % 3]*2, t + i*0.6, 0.25, 'square', 0.008); }
  function jingle(){ const t = ctx.currentTime + 0.05; [523.3, 659.3, 784, 1046.5].forEach((fr, i) => note(fr, t + i*0.12, 0.4, 'square', 0.03)); }
  const bedLevel = () => on && !cur ? (speaking ? 0.25 : 1) : 0;
  // the announcer speaks through the game's voice (voice.js: Piper clips or on-device synthesis); the music ducks under him
  function say(text){ speaking = true; g.gain.setTargetAtTime(bedLevel(), ctx.currentTime, 0.3); yt.volume(30);
    return VOX.say(text, {channel: 'radio', gain: 0.9}).then(() => { speaking = false; if (on) { g.gain.setTargetAtTime(bedLevel(), ctx.currentTime, 0.8); yt.volume(100); } }); }
  // the next song: a request first (in the order they came in), otherwise the next one of the station's own list
  function pickTrack(){ const r = req.shift(); if (r) { onQueue(req.list()); return {...r, req: true}; } const t = order[pi++ % order.length]; return {id: t[0], title: t[1], by: ''}; }
  // put a song on the air: the player is told to play it, and if it never starts (blocked, removed) the next one follows
  function air(t){ cur = t; g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); last = null; yt.play(t.id); onNow(t); clearTimeout(watch);
    watch = setTimeout(() => { if (on && cur === t && last !== 1) { cur = null; advance(); } }, 30000); }
  async function advance(){
    if (!on || busy) return; busy = true; clearTimeout(watch); const t = pickTrack();
    const line = t.req ? `Lagu permintaan dari ${t.by}. ${t.title}. Selamat mendengarkan.` : n++ % 3 === 2 ? segment(k++, state()) : '';
    if (line) { if (k % 5 === 1) jingle(); await say(line); }
    busy = false; if (on) air(t); }
  return {
    get on(){ return on; }, get now(){ return cur; }, queue: () => req.list(),
    set(v){ on = v; if (v) { jingle(); retry = 30; busy = false; air(pickTrack()); } else { g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); VOX.stopChannel('radio'); clearTimeout(watch); yt.stop(); busy = false; speaking = false; const was = cur; cur = null; if (was) onNow(null); } },
    tick(dt){ if (!on) return; if (!cur && (timer -= dt) <= 0) { timer = 2.4; bar(); } if (!cur && !busy && (retry -= dt) <= 0) { retry = 5; advance(); } },
    duck(k2){ f.frequency.setTargetAtTime(k2 ? 900 : 1800, ctx.currentTime, 0.3); },
    // a request from this player or (through the server) from another one: {id, title, by, t, rid}; the result says where it queued
    request(r){ const res = req.add(r); if (res.ok) onQueue(req.list()); return res; },
    // the YouTube player's state: 0 ended, 1 playing, 'error' = the video cannot be played here
    player(code){ if (!cur || code === last) return; last = code; if (code === 1) clearTimeout(watch); else if (code === 0 || code === 'error') { cur = null; clearTimeout(watch); advance(); } }};
}
