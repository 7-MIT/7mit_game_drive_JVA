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

// Emergency and service numbers, each answered by the institution itself. The operator greets, offers that institution's
// services as a menu (a menu item may open a sub-menu), then says a fixed line and either sends units to the caller's
// location (read back with the road and km: that line is synthesised on the device) or gives a report made on the spot
// (info: traffic, etle, health, facility, disaster). Units: police, ambulance, damkar, sar (rescue team), tow.
// g: the phone's colour group; icon: the contact's icon.
const SAY = {
  crash: 'Laporan kecelakaan kami terima. Ambulans dan patroli polisi kami kirim.',
  amb: 'Ambulans kami berangkatkan sekarang. Jangan pindahkan korban.',
  fire: 'Unit pemadam kami berangkatkan. Menjauh dari kendaraan yang terbakar.',
  sar: 'Tim SAR kami berangkatkan bersama ambulans. Tetap tenang dan jangan tinggalkan lokasi.',
  police: 'Laporan kami terima. Patroli terdekat kami arahkan ke lokasi Anda.',
};
// what 133 and 151 offer, and what they say back
export const TOW_FREE = 'Layanan derek ini gratis, tidak dipungut biaya apa pun. Yang dibayar hanya biaya bengkel, bila kendaraan perlu diperbaiki.';
export const FUEL_HELP = 'Petugas kami membawa BBM darurat sepuluh liter. Jasa petugas gratis, BBM dibayar sesuai harga SPBU.';
export const TIRE_HELP = 'Baik, petugas layanan dan derek kami kirim. Bila tidak bisa diperbaiki di tempat, kendaraan dibawa gratis ke bengkel terdekat.';
export const REPORT_HELP = 'Terima kasih atas laporannya. Petugas patroli kami arahkan ke lokasi untuk mengamankan jalan.';
const ROAD_SERVICES = [
  {k: 'tow', label: 'Derek (gratis)', say: TOW_FREE, units: ['tow']},
  {k: 'info', label: 'Informasi lalu lintas', info: 'traffic'},
  {k: 'other', label: 'Layanan lainnya', sub: [
    {k: 'fuel', label: 'Kehabisan BBM', say: FUEL_HELP, units: ['tow'], fuel: true},
    {k: 'tire', label: 'Ban bocor / mogok', say: TIRE_HELP, units: ['tow']},
    {k: 'report', label: 'Lapor gangguan atau kecelakaan', say: REPORT_HELP, units: ['police']}]}];
export const DISPATCH = {
  '112': {name: 'Layanan Darurat 112', g: 'amb', icon: 'Siren', greet: 'Layanan darurat satu satu dua. Silakan sampaikan keadaan darurat Anda.', menu: [
    {k: 'crash', label: 'Kecelakaan lalu lintas', say: 'Kami teruskan ke ambulans dan kepolisian.', units: ['ambulance', 'police']},
    {k: 'fire', label: 'Kendaraan terbakar', say: 'Kami teruskan ke pemadam kebakaran.', units: ['damkar']},
    {k: 'trap', label: 'Ada yang terjebak / butuh penyelamatan', say: 'Kami teruskan ke Badan SAR Nasional.', units: ['sar']},
    {k: 'breakdown', label: 'Kendaraan mogok', say: 'Kami teruskan ke layanan derek. Layanan derek gratis.', units: ['tow']},
    {k: 'crime', label: 'Gangguan keamanan', say: 'Kami teruskan ke kepolisian.', units: ['police']},
    {k: 'sick', label: 'Ada yang sakit', say: 'Kami teruskan ke layanan ambulans.', units: ['ambulance']}]},
  '110': {name: 'Kepolisian Negara Republik Indonesia (Polri) 110', g: 'polisi', icon: 'Shield', greet: 'Kepolisian Negara Republik Indonesia, layanan satu satu nol. Ada yang bisa kami bantu?', menu: [
    {k: 'crash', label: 'Lapor kecelakaan', say: SAY.crash, units: ['police', 'ambulance']},
    {k: 'crime', label: 'Lapor gangguan keamanan', say: SAY.police, units: ['police']},
    {k: 'jam', label: 'Lapor jalan terhalang / kemacetan', say: 'Terima kasih. Petugas kami kirim untuk mengurai lalu lintas dan menyingkirkan kendaraan yang menghalangi jalan.', units: ['police']},
    {k: 'etle', label: 'Cek tilang elektronik (ETLE)', info: 'etle'}]},
  '118': {name: 'Layanan Ambulans Gawat Darurat 118', g: 'amb', icon: 'Ambulance', greet: 'Layanan ambulans gawat darurat, satu satu delapan. Siapa yang membutuhkan pertolongan?', menu: [
    {k: 'injured', label: 'Ada korban luka', say: SAY.amb, units: ['ambulance']},
    {k: 'sick', label: 'Ada yang sakit / pingsan', say: SAY.amb, units: ['ambulance']},
    {k: 'tired', label: 'Saya kelelahan / mengantuk', info: 'health'}]},
  '119': {name: 'Kementerian Kesehatan · Layanan Kesehatan 119', g: 'amb', icon: 'HeartPulse', greet: 'Layanan kesehatan, satu satu sembilan. Ada yang bisa kami bantu?', menu: [
    {k: 'amb', label: 'Butuh ambulans', say: SAY.amb, units: ['ambulance']},
    {k: 'tired', label: 'Konsultasi kelelahan / mengantuk', info: 'health'},
    {k: 'facility', label: 'Info fasilitas kesehatan terdekat', info: 'facility'}]},
  '113': {name: 'Dinas Pemadam Kebakaran dan Penyelamatan 113', g: 'derek', icon: 'Flame', greet: 'Pemadam kebakaran dan penyelamatan, satu satu tiga. Apa yang terjadi?', menu: [
    {k: 'carfire', label: 'Kendaraan terbakar', say: SAY.fire, units: ['damkar']},
    {k: 'fire', label: 'Kebakaran di sekitar jalan', say: 'Unit pemadam kami berangkatkan ke lokasi.', units: ['damkar']},
    {k: 'rescue', label: 'Penyelamatan (terjepit di kendaraan)', say: 'Unit penyelamat dan ambulans kami berangkatkan. Jangan memaksa keluar bila terjepit.', units: ['damkar', 'ambulance']}]},
  '115': {name: 'Badan SAR Nasional (Basarnas) 115', g: 'polisi', icon: 'LifeBuoy', greet: 'Badan SAR Nasional, satu satu lima. Apa yang terjadi?', menu: [
    {k: 'trap', label: 'Korban terjebak / kecelakaan berat', say: SAY.sar, units: ['sar']},
    {k: 'missing', label: 'Pencarian orang hilang', say: 'Laporan kami catat. Tim SAR kami arahkan ke lokasi yang Anda sampaikan.', units: ['sar']},
    {k: 'disaster', label: 'Info bencana (banjir / longsor)', info: 'disaster'}]},
  '133': {name: 'Pusat Informasi Jalan Tol 133', g: 'derek', icon: 'Headset', greet: 'Pusat informasi jalan tol, satu tiga tiga. Kami melayani derek gratis, informasi lalu lintas, dan layanan lainnya. Ada yang bisa dibantu?', menu: ROAD_SERVICES},
  '151': {name: 'Dinas Perhubungan (Dishub) 151', g: 'derek', icon: 'TrafficCone', greet: 'Call center Dinas Perhubungan, satu lima satu. Kami melayani derek gratis, informasi lalu lintas, dan layanan lainnya. Ada yang bisa dibantu?', menu: ROAD_SERVICES},
};
export const UNIT_NAME = {police: 'Patroli polisi', ambulance: 'Ambulans', damkar: 'Mobil pemadam kebakaran', sar: 'Tim SAR', tow: 'Mobil derek'};
// the location read-back (synthesised on the device): road, km, the units, minutes
export const dispatchLocation = ({road, km, units, min}) => `Baik. Lokasi Anda terdeteksi di ${road || 'ruas jalan ini'}${km ? `, kilometer ${km}` : ''}. ${(units || []).map(u => UNIT_NAME[u] || 'Petugas').join(' dan ')} menuju ke sana, perkiraan tiba ${min} menit.`;

// the caption on the phone screen: numbers written as numbers again
const SPOKEN = [['satu satu dua', '112'], ['satu satu nol', '110'], ['satu satu delapan', '118'], ['satu satu sembilan', '119'], ['satu satu tiga', '113'], ['satu satu lima', '115'], ['satu tiga tiga', '133'], ['satu lima satu', '151']];
export const shown = t => SPOKEN.reduce((s, [a, b]) => s.replace(a, b), t);
export const CANCEL = 'Baik, panggilan kami tutup. Tetap hati-hati di jalan.';
export const UNIT_END = {police: 'Patroli sudah kami arahkan ke lokasi Anda. Tetap di tempat yang aman dan nyalakan lampu hazard.',
  ambulance: 'Ambulans sudah berangkat. Jangan pindahkan korban, tunggu petugas datang.',
  damkar: 'Unit pemadam sudah meluncur. Menjauh dari kendaraan yang terbakar, jangan coba memadamkan sendiri.',
  sar: 'Tim SAR sedang menuju lokasi Anda. Tetap tenang dan jangan tinggalkan lokasi.',
  tow: 'Derek dan petugas layanan sedang menuju lokasi Anda. Nyalakan lampu hazard dan tunggu di belakang pembatas.'};
export const INFO_END = 'Demikian informasinya. Selamat jalan dan hati-hati.';
// the traffic report read out on 133 / 151 (synthesised: it has the place in it)
export const trafficInfo = ({road, jam, weather, rain, rest, restKm}) => `Informasi lalu lintas ${road || 'ruas ini'}: arus ${jam > 10 ? 'padat merayap' : jam > 4 ? 'ramai, sedikit tersendat' : 'lancar'}. Cuaca ${weather}${rain ? ', jalan licin, kurangi kecepatan' : ''}.${rest ? ` ${rest} sekitar ${restKm} kilometer di depan.` : ''}`;
// every menu item of every number, sub-menus included
export function menuItems(menu){ const out = []; for (const m of menu || []) { out.push(m); if (m.sub) out.push(...menuItems(m.sub)); } return out; }
// all fixed lines (for the clip builder)
export function fixedLines(){ const s = new Set([STATION_ID, ...ADS, ...TIPS, CANCEL, INFO_END, ...Object.values(UNIT_END), TOW_FREE]);
  for (const d of Object.values(DISPATCH)) { s.add(d.greet); for (const m of menuItems(d.menu)) if (m.say) s.add(m.say); }
  return [...s]; }
