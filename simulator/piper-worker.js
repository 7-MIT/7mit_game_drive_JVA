// Piper text-to-speech on the device, in a worker so the game never waits for it. Indonesian voice id_ID-news_tts-medium:
// espeak-ng turns the text into phonemes (piper_phonemize, WebAssembly), the VITS model (onnxruntime-web) turns them into audio.
// Messages in: {type: 'init', model: url}, {type: 'say', id, text}. Out: {type: 'ready'} | {type: 'audio', id, pcm, rate} | {type: 'error', id, message}.
const ORT = 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/';
const PHON = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/dist/piper-o91UDS6e.js';
const PWASM = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
let session = null, config = null, phon = null, ready = null, pData = null, pWasm = null;

// the model (about 60 MB) is downloaded once and kept in the browser's cache storage
async function cached(url){
  try { const c = await caches.open('drive7-voice-v1'); let r = await c.match(url); if (!r) { r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); await c.put(url, r.clone()); } return r; }
  catch (e) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r; } }
async function init(model){
  importScripts(ORT + 'ort.wasm.min.js');                        // global `ort`
  ort.env.wasm.wasmPaths = ORT; ort.env.wasm.numThreads = 1;      // one thread: no cross-origin isolation needed, and the game keeps the other cores
  phon = (await import(PHON)).createPiperPhonemize;
  // espeak-ng's data (18 MB) and wasm are fetched once and handed to every phonemizer run, not downloaded per sentence
  [pData, pWasm] = await Promise.all([PWASM + '.data', PWASM + '.wasm'].map(async u => (await cached(u)).arrayBuffer()));
  config = await (await cached(model + '.json')).json();
  session = await ort.InferenceSession.create(await (await cached(model)).arrayBuffer(), {executionProviders: ['wasm']});
}
function phonemes(text){ return new Promise((resolve, reject) => {
  phon({print: d => { try { resolve(JSON.parse(d).phoneme_ids); } catch (e) { reject(e); } }, printErr: m => reject(new Error(m)),
    wasmBinary: pWasm, getPreloadedPackage: () => pData, locateFile: u => u.endsWith('.wasm') ? PWASM + '.wasm' : u.endsWith('.data') ? PWASM + '.data' : u})
    .then(m => m.callMain(['-l', config.espeak.voice, '--input', JSON.stringify([{text}]), '--espeak_data', '/espeak-ng-data'])).catch(reject); }); }
async function speak(text){
  const parts = text.match(/[^.!?]+[.!?]*/g) || [text], pcms = [];
  for (const part of parts) { const t = part.trim(); if (!t) continue; const ids = await phonemes(t), inf = config.inference;
    const feeds = {input: new ort.Tensor('int64', ids, [1, ids.length]), input_lengths: new ort.Tensor('int64', [ids.length]), scales: new ort.Tensor('float32', [inf.noise_scale, inf.length_scale*1.02, inf.noise_w])};
    if (Object.keys(config.speaker_id_map || {}).length) feeds.sid = new ort.Tensor('int64', [0]);
    pcms.push((await session.run(feeds)).output.data); pcms.push(new Float32Array(Math.round(config.audio.sample_rate*0.12))); }
  const n = pcms.reduce((a, p) => a + p.length, 0), pcm = new Float32Array(n); let o = 0; for (const p of pcms) { pcm.set(p, o); o += p.length; }
  return pcm; }
onmessage = async e => { const m = e.data;
  if (m.type === 'init') { try { ready = ready || init(m.model); await ready; postMessage({type: 'ready'}); } catch (err) { ready = null; postMessage({type: 'error', message: String(err && err.message || err)}); } return; }
  if (m.type === 'say') { try { await ready; const pcm = await speak(m.text); postMessage({type: 'audio', id: m.id, pcm, rate: config.audio.sample_rate}, [pcm.buffer]); }
    catch (err) { postMessage({type: 'error', id: m.id, message: String(err && err.message || err)}); } } };
