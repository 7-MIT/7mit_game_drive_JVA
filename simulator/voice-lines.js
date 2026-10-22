// Every fixed spoken line of the game in one place: the radio's station id, ads and tips, and the emergency dispatchers.
// The GitHub Action tools/voice-build.py renders each of them once with Piper (Indonesian voice) into a clip on the branch
// voice-data; the game plays the clip when the text matches (hashText), and synthesises anything else on the device (voice.js).

// FNV-1a over the normalised text: the clip's file name
export const normText = t => String(t).replace(/\s+/g, ' ').trim();
export function hashText(t){ let h = 2166136261; for (const c of normText(t)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }

export const STATION = '7MIT FM 97,7';
export const STATION_ID = `Anda mendengarkan tujuh mit F M, sembilan puluh tujuh koma tujuh, teman perjalanan Anda di jalanan Nusantara. Saya Mas Bayu, menemani Anda sampai tujuan.`;
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

// Emergency and service numbers. The dispatcher answers with the fixed greeting, then (after the caller picks what happened) reads
// back the location and what is on its way: that second line has the place in it, so it is synthesised on the device.
export const DISPATCH = {
  '112': {name: 'Panggilan Darurat 112', who: 'Rina', greet: 'Layanan panggilan darurat satu satu dua, dengan petugas Rina. Apa keadaan darurat Anda?', ask: true},
  '110': {name: 'Polisi 110', who: 'Brigadir Andi', greet: 'Polisi, satu satu nol. Dengan Brigadir Andi, ada yang bisa kami bantu?', unit: 'police', end: 'Patroli Jalan Raya terdekat sudah kami arahkan ke lokasi Anda. Tetap di tempat yang aman.'},
  '118': {name: 'Ambulans 118', who: 'petugas Sari', greet: 'Ambulans gawat darurat, satu satu delapan. Dengan petugas Sari, siapa yang terluka?', unit: 'ambulance', end: 'Ambulans sudah berangkat. Jangan pindahkan korban, tunggu petugas datang.'},
  '119': {name: 'Ambulans 119', who: 'petugas Sari', greet: 'Pusat layanan kesehatan, satu satu sembilan. Dengan petugas Sari, siapa yang membutuhkan pertolongan?', unit: 'ambulance', end: 'Ambulans sudah berangkat. Jangan pindahkan korban, tunggu petugas datang.'},
  '113': {name: 'Pemadam Kebakaran 113', who: 'petugas Dimas', greet: 'Pemadam kebakaran, satu satu tiga. Dengan petugas Dimas, di mana lokasi kebakaran?', unit: 'damkar', end: 'Unit pemadam sudah meluncur. Menjauh dari kendaraan yang terbakar, jangan coba memadamkan sendiri.'},
  '115': {name: 'Basarnas 115', who: 'petugas Yoga', greet: 'Badan SAR Nasional, satu satu lima. Dengan petugas Yoga, apa yang terjadi?', unit: 'ambulance', end: 'Tim penyelamat kami arahkan ke lokasi Anda. Tetap tenang dan jangan tinggalkan lokasi.'},
  // 133 (tol) and 151 (Dishub): free towing, traffic information and other road services
  '133': {name: 'Info Tol 133', who: 'petugas Hadi', greet: 'Info tol satu tiga tiga, dengan Hadi. Kami melayani derek gratis, informasi lalu lintas, dan layanan lainnya. Ada yang bisa dibantu?', unit: 'tow', services: true},
  '151': {name: 'Call center Dishub 151', who: 'petugas Rudi', greet: 'Call center Dinas Perhubungan, satu lima satu, dengan Rudi. Kami melayani derek gratis, informasi lalu lintas, dan layanan lainnya. Ada yang bisa dibantu?', unit: 'tow', services: true},
};
// what the caller can say on 112 (and where it is passed on)
export const EMERGENCIES = [['crash', 'Kecelakaan', 'ambulance', 'Kami teruskan ke ambulans dan polisi.'], ['breakdown', 'Kendaraan mogok', 'tow', 'Kami teruskan ke layanan derek jalan tol.'],
  ['fire', 'Kendaraan terbakar', 'damkar', 'Kami teruskan ke pemadam kebakaran.'], ['crime', 'Butuh polisi', 'police', 'Kami teruskan ke kepolisian.'], ['sick', 'Ada yang sakit', 'ambulance', 'Kami teruskan ke ambulans.']];
export const UNIT_NAME = {police: 'Patroli polisi', ambulance: 'Ambulans', damkar: 'Mobil pemadam kebakaran', tow: 'Mobil derek'};
// the location read-back (synthesised on the device): road, km, minutes
export const dispatchLocation = ({road, km, unit, min}) => `Baik. Lokasi Anda terdeteksi di ${road || 'ruas jalan ini'}${km ? `, kilometer ${km}` : ''}. ${UNIT_NAME[unit] || 'Petugas'} menuju ke sana, perkiraan tiba ${min} menit.`;

// the caption on the phone screen: numbers written as numbers again
const SPOKEN = [['satu satu dua', '112'], ['satu satu nol', '110'], ['satu satu delapan', '118'], ['satu satu sembilan', '119'], ['satu satu tiga', '113'], ['satu satu lima', '115'], ['satu tiga tiga', '133'], ['satu lima satu', '151']];
export const shown = t => SPOKEN.reduce((s, [a, b]) => s.replace(a, b), t);
export const CANCEL = 'Baik, panggilan kami tutup. Tetap hati-hati di jalan.';
export const UNIT_END = {police: DISPATCH['110'].end, ambulance: DISPATCH['118'].end, damkar: DISPATCH['113'].end,
  tow: 'Derek dan petugas layanan sedang menuju lokasi Anda. Nyalakan lampu hazard dan tunggu di belakang pembatas.'};
// what 133 and 151 offer, and what they say back
export const SERVICE_MENU = [['tow', 'Derek (gratis)'], ['info', 'Informasi lalu lintas'], ['other', 'Layanan lainnya'], ['no', 'Tidak jadi']];
export const OTHER_MENU = [['fuel', 'Kehabisan BBM'], ['tire', 'Ban bocor / mogok'], ['report', 'Lapor gangguan atau kecelakaan'], ['no', 'Tidak jadi']];
export const TOW_FREE = 'Layanan derek ini gratis, tidak dipungut biaya apa pun. Yang dibayar hanya biaya bengkel, bila kendaraan perlu diperbaiki.';
export const FUEL_HELP = 'Petugas kami membawa BBM darurat sepuluh liter. Jasa petugas gratis, BBM dibayar sesuai harga SPBU.';
export const TIRE_HELP = 'Baik, petugas layanan dan derek kami kirim. Bila tidak bisa diperbaiki di tempat, kendaraan dibawa gratis ke bengkel terdekat.';
export const REPORT_HELP = 'Terima kasih atas laporannya. Petugas patroli kami arahkan ke lokasi untuk mengamankan jalan.';
export const INFO_END = 'Demikian informasinya. Selamat jalan dan hati-hati.';
// the traffic report read out on 133 / 151 (synthesised: it has the place in it)
export const trafficInfo = ({road, jam, weather, rain, rest, restKm}) => `Informasi lalu lintas ${road || 'ruas ini'}: arus ${jam > 10 ? 'padat merayap' : jam > 4 ? 'ramai, sedikit tersendat' : 'lancar'}. Cuaca ${weather}${rain ? ', jalan licin, kurangi kecepatan' : ''}.${rest ? ` ${rest} sekitar ${restKm} kilometer di depan.` : ''}`;
// all fixed lines (for the clip builder)
export function fixedLines(){ const s = new Set([STATION_ID, ...ADS, ...TIPS, CANCEL, ...Object.values(UNIT_END), TOW_FREE, FUEL_HELP, TIRE_HELP, REPORT_HELP, INFO_END]);
  for (const d of Object.values(DISPATCH)) { s.add(d.greet); if (d.end) s.add(d.end); }
  for (const [, , , pass] of EMERGENCIES) s.add(pass);
  return [...s]; }
