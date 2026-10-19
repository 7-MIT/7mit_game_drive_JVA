// In-car radio "7MIT FM 97,7": a light synthesised music bed, a station jingle, and a fictional announcer (the browser's speech voice)
// who reads the time, the weather, the traffic where you are and fictional ads. Everything here is made up for the game.
export const STATION = '7MIT FM 97,7';
export const ADS = [
  'Lapar di jalan? Mampir ke Warung Sambal Bu Tejo di rest area terdekat. Pedasnya bikin melek, harganya bikin senyum.',
  'Oli Tangguh Plus. Mesin adem, perjalanan jauh tetap tenang. Oli Tangguh Plus, temani mudikmu.',
  'Kopi Kenangan Senja, kopi susu gula aren dalam botol. Segar diminum dingin, pas buat yang nyetir malam.',
  'Ban Gripa Nusantara. Basah atau kering, cengkeramannya tetap pede. Ganti ban sekarang, diskon untuk pengemudi driving tujuh mit.',
  'Bengkel Maju Jaya, servis kilat tiga puluh menit. Ganti oli gratis cek rem. Buka setiap hari, tanpa antre.',
  'Asuransi Aman Sentosa. Jalan raya penuh kejutan, perlindungan jangan ditunda.',
  'Keripik Pedas Mak Ijah, oleh-oleh khas perjalanan. Satu bungkus tak pernah cukup.',
  'Travel Nyaman Trans Jawa. Kursi lega, sopir berpengalaman. Pesan tiket lewat HP-mu sekarang.',
];
export const TIPS = [
  'Jangan lupa istirahat setiap dua jam berkendara. Mampir ke rest area, regangkan badan.',
  'Pakai sein sebelum pindah lajur, ya. Pengendara lain bukan peramal.',
  'Bahu jalan hanya untuk keadaan darurat. Jangan dipakai untuk menyalip.',
  'Saat hujan, kurangi kecepatan dan jaga jarak lebih jauh dari biasanya.',
  'Cek saldo e-Toll sebelum masuk gerbang tol supaya tidak bikin antrean.',
  'Mengantuk? Berhenti di tempat aman. Kopi bisa menunggu, keselamatan tidak.',
];
const pick = a => a[Math.floor(Math.random()*a.length)];
const hhmm = h => `${String(Math.floor(h)).padStart(2, '0')}.${String(Math.floor((h % 1)*60)).padStart(2, '0')}`;
// what the announcer says next: rotates through station id, time & weather, traffic, an ad and a tip
export function segment(n, S){ const k = n % 5;
  if (k === 0) return `Anda mendengarkan ${STATION}, teman perjalanan Anda di jalanan Nusantara. Saya Mas Bayu, menemani Anda sampai tujuan.`;
  if (k === 1) return `Sekarang pukul ${hhmm(S.hour)}. Cuaca di sekitar ${S.place || 'lokasi Anda'} ${S.weather}. ${S.rain ? 'Hati-hati, jalanan licin.' : 'Selamat menikmati perjalanan.'}`;
  if (k === 2) return S.jam > 6 ? `Info lalu lintas: arus di ${S.road || 'ruas ini'} terpantau padat merayap. Sabar ya, tetap di lajur Anda.` : `Info lalu lintas: arus di ${S.road || 'ruas ini'} terpantau lancar. Tetap patuhi batas kecepatan.`;
  if (k === 3) return pick(ADS);
  return pick(TIPS); }

export function createRadio({ctx, out, state}){
  // music bed: a slow four-chord loop on soft pads with a little pulse
  const g = ctx.createGain(); g.gain.value = 0; g.connect(out); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; f.connect(g);
  const CH = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]];
  let on = false, beat = 0, timer = 0, talk = 0, n = 0, speaking = false, voice = null;
  const pickVoice = () => { const vs = speechSynthesis.getVoices(); voice = vs.find(v => /^id/i.test(v.lang)) || null; };
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function note(fr, t, d, type = 'triangle', gain = 0.05){ const o = ctx.createOscillator(), e = ctx.createGain(); o.type = type; o.frequency.value = fr; e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(gain, t + 0.08); e.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(e); e.connect(f); o.start(t); o.stop(t + d + 0.05); }
  function bar(){ const t = ctx.currentTime + 0.05, c = CH[beat % 4]; beat++; for (const fr of c) note(fr, t, 2.3, 'sine', 0.035); note(c[0]/2, t, 0.5, 'triangle', 0.07); note(c[0]/2, t + 1.2, 0.5, 'triangle', 0.05);
    for (let i = 0; i < 4; i++) note(c[(i + beat) % 3]*2, t + i*0.6, 0.25, 'square', 0.008); }
  function jingle(){ const t = ctx.currentTime + 0.05; [523.3, 659.3, 784, 1046.5].forEach((fr, i) => note(fr, t + i*0.12, 0.4, 'square', 0.03)); }
  function say(text){ if (!('speechSynthesis' in window)) return; const u = new SpeechSynthesisUtterance(text); u.lang = 'id-ID'; if (voice) u.voice = voice; u.rate = 1.02; u.pitch = 1.05;
    speaking = true; g.gain.setTargetAtTime(0.25, ctx.currentTime, 0.3); u.onend = u.onerror = () => { speaking = false; if (on) g.gain.setTargetAtTime(1, ctx.currentTime, 0.8); }; speechSynthesis.speak(u); }
  return {
    get on(){ return on; },
    set(v){ on = v; g.gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.4); if (v) { talk = 3; jingle(); } else if ('speechSynthesis' in window) speechSynthesis.cancel(); },
    tick(dt){ if (!on) return; if ((timer -= dt) <= 0) { timer = 2.4; bar(); }
      if (!speaking && (talk -= dt) <= 0) { talk = 35 + Math.random()*40; const S = state(); if (n % 5 === 0) jingle(); say(segment(n++, S)); } },
    duck(k){ f.frequency.setTargetAtTime(k ? 900 : 1800, ctx.currentTime, 0.3); }};
}
