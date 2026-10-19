// English option: the game is written in Indonesian; with English chosen, the visible interface text (buttons, labels, settings,
// dialogs, HUD, common messages) is swapped for English as it appears on the page. Road signs, place names and the
// navigation voice stay Indonesian, as on the real roads.
const KEY = 'drive7_lang';
export const getLang = () => { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'id'; } catch (e) { return 'id'; } };

// exact strings (trimmed)
export const DICT = {
  // welcome page
  'Simulator berkendara Indonesia': 'Indonesian driving simulator', 'Jalan panjang.': 'The long road.', 'Petualangan': 'Your', 'mu.': ' adventure.',
  'Jelajahi jalanan Jawa. Pilih kendaraanmu, tentukan tujuan, dan nikmati perjalanan.': 'Explore the roads of Java. Pick your vehicle, choose a destination and enjoy the drive.',
  'Rencana perjalanan': 'Trip plan', 'Mode perjalanan': 'Trip mode', 'Tipe kendaraan': 'Vehicle', 'Titik awal': 'Start', 'Tujuan': 'Destination', 'Preferensi rute': 'Route preference',
  'Arah awal': 'First direction', 'Nama pemain multiplayer': 'Multiplayer name', 'Modifikasi kendaraan': 'Vehicle mods', 'Warna, pelek, motif, plat, dan lainnya': 'Paint, rims, livery, plate and more',
  'Warna cat': 'Paint colour', 'Warna pelek': 'Rim colour', 'Motif bodi': 'Livery', 'Warna kedua': 'Second colour', 'Kaca film': 'Window tint', 'Plat nomor': 'Number plate', 'Jenis plat': 'Plate type',
  'Bening': 'Clear', 'Sedang (40%)': 'Medium (40%)', 'Gelap (80%)': 'Dark (80%)', 'Otomatis': 'Automatic', 'Pribadi (putih)': 'Private (white)', 'Angkutan (kuning)': 'Public transport (yellow)',
  'Dinas (merah)': 'Government (red)', 'Polri (hitam)': 'Police (black)', 'Diplomatik (biru)': 'Diplomatic (blue)', 'Perdagangan bebas (hijau)': 'Free trade zone (green)', 'Kendaraan listrik': 'Electric vehicle',
  'Spoiler': 'Spoiler', 'Ceper': 'Lowered', 'Striping sport': 'Sport stripes', 'Suasana perjalanan': 'Time of day', 'Siang': 'Day', 'Senja': 'Dusk', 'Malam': 'Night', 'Pagi': 'Morning',
  'Mulai berkendara': 'Start driving', 'Cara bermain': 'How to play', 'Perjalanan langsung dimulai setelah loading selesai.': 'The drive starts as soon as loading is done.',
  'Perjalanan siang hari': 'A daytime drive', 'Perjalanan saat senja': 'A drive at dusk', 'Perjalanan malam hari': 'A night drive', 'Kamu yang tentukan arah.': 'You choose the way.',
  'Tol, perkotaan, dan perjalanan antarkota.': 'Toll roads, cities and intercity trips.', 'Jelajahi': 'Explore', 'Dunia berkendara': 'A world to drive', 'Mobil, motor, truk, angkot, dan sepeda.': 'Cars, motorbikes, trucks, angkot and bicycles.',
  'Lebih banyak aktivitas': 'More to do', 'Pekerjaan, navigasi, dan HP dalam game.': 'Jobs, navigation and an in-game phone.', 'Grafis adaptif': 'Adaptive graphics', 'Kualitas mengikuti kemampuan perangkat.': 'Quality follows your device.',
  'Punya saran atau kurang fitur?': 'Missing a feature or have an idea?', 'Kirim Saran & Kesan': 'Send feedback', 'Siap mulai?': 'Ready?', 'Mengerti': 'Got it', 'Baru pertama bermain?': 'First time?', 'Buka tutorial interaktif': 'Open the interactive tutorial',
  'Menyiapkan perjalananmu': 'Getting your trip ready', 'Simulator akan terbuka setelah semuanya siap.': 'The simulator opens when everything is ready.', 'Memuat simulator': 'Loading the simulator', 'Muat ulang': 'Reload',
  'Tip: gunakan lajur kiri dan patuhi batas kecepatan.': 'Tip: keep left and mind the speed limit.', 'Masuk / Daftar': 'Sign in / Sign up',
  'Rute (A → B)': 'Route (A → B)', 'Keliling bebas': 'Free roam', 'Santai': 'Relaxed', 'Multiplayer': 'Multiplayer', 'Tol + jalan nasional (tercepat)': 'Toll + national roads (fastest)', 'Utamakan tol': 'Prefer toll roads', 'Jalan nasional saja': 'National roads only',
  'Sedan': 'Sedan', 'Bus': 'Bus', 'Truk': 'Truck', 'Taksi': 'Taxi', 'Sepeda': 'Bicycle', 'Motor': 'Motorbike', 'Ambulans': 'Ambulance', 'Damkar': 'Fire engine', 'Polisi': 'Police',
  // HUD and buttons
  'Pengaturan': 'Settings', 'Tutorial': 'Tutorial', 'Terbang': 'Fly', 'Autopilot': 'Autopilot', 'Kamera': 'Camera', 'Peta': 'Map', 'HUD': 'HUD', 'Sirene': 'Siren', 'ETLE': 'ETLE',
  'Sein kiri': 'Left signal', 'Sein kanan': 'Right signal', 'Hazard': 'Hazard', 'Klakson': 'Horn', 'Spion': 'Mirrors', 'Layanan': 'Services', 'HP': 'Phone', 'Kerja': 'Work', 'Garasi': 'Garage',
  'Foto': 'Photo', 'Replay': 'Replay', 'Gigi +': 'Gear +', 'Gigi −': 'Gear −', 'Kopling': 'Clutch', 'Musik': 'Music', 'Minta maaf': 'Apologise', 'Panggil derek': 'Call a tow truck', 'Keluar mobil': 'Get out',
  'Layar penuh': 'Full screen', 'REM': 'BRAKE', 'GAS': 'GAS', 'KAYUH': 'PEDAL', 'Lanjut perjalanan': 'Continue the trip', 'Arah di': 'At', 'Ubah': 'Change', 'Sisa': 'Left', 'Tol': 'Toll', 'Langgar': 'Offences',
  'Tabrak': 'Crashes', 'Tiba': 'Arrive', 'BBM': 'Fuel', 'Energi': 'Energy', 'Kantuk': 'Sleepy', 'Tunai': 'Cash', 'Bebas': 'Free', 'Lancar': 'Clear', 'Batas kecepatan': 'Speed limit', 'Rute di depan': 'Route ahead',
  'Pulau Jawa · Lajur kiri': 'Java · Keep left', 'Lajur': 'Lane', 'Panduan lajur': 'Lane guide', 'Ikuti': 'Follow', 'Tutup': 'Close', 'Tutup peta': 'Close map', 'Cari tempat': 'Search places',
  'Cari kota, gerbang tol, simpang susun…': 'Search towns, toll gates, interchanges…', 'Mode Terbang': 'Flight mode', 'Mode pekerjaan': 'Jobs', 'Berhenti bekerja': 'Stop working', 'Mode foto': 'Photo mode',
  'Kembali ke asal': 'Back to the start', 'Lanjut keliling': 'Keep roaming', 'Rute lain': 'Another route', 'Tidak jadi menyeberang': 'Do not cross', 'Percepat': 'Skip ahead', 'Lewati': 'Skip', 'Ulangi': 'Again', 'Mulai': 'Start',
  'Mulai mengemudi': 'Start driving', 'Rute cepat': 'Quick routes', 'Pilih rute cepat…': 'Pick a quick route…', 'Kirim': 'Send', 'Ketik pesan… (Enter)': 'Type a message… (Enter)', 'Mic': 'Mic', 'Suara': 'Sound',
  // settings
  'Lalu lintas': 'Traffic', 'Mode mudik Lebaran': 'Eid homecoming (mudik) mode', 'Cuaca': 'Weather', 'Bentuk jalan': 'Road shape', 'Jarak pandang': 'View distance', 'Grafis': 'Graphics', 'Transmisi': 'Gearbox',
  'Setir miring (HP/tablet)': 'Tilt steering (phone/tablet)', 'Radio 7MIT FM': 'Radio 7MIT FM', 'Setir otomatis': 'Lane keeping', 'Suara navigasi': 'Voice guidance', 'Tampilan HUD': 'HUD', 'Atur jam': 'Set the time',
  'Asisten setir': 'Steering assist', 'Jalannya jam': 'Clock speed', 'Jumlah lajur per arah (semua jalan)': 'Lanes per direction (all roads)', 'Tutup lajur · arah saya': 'Close lanes · my direction', 'Tutup lajur · arah lawan': 'Close lanes · other direction',
  'Contraflow': 'Contraflow', 'Lajur contraflow': 'Contraflow lanes', 'Jalan overpass': 'Overpass roads', 'Skala jarak': 'Distance scale', 'Rute': 'Route', 'Ganti rute': 'Change route', 'Saran & Kesan': 'Feedback',
  'Belakang': 'Chase', 'Kokpit': 'Cockpit', 'Drone': 'Drone', 'Sinematik (drone otomatis)': 'Cinematic (auto drone)', 'Simpang susun': 'Interchange', 'Orbit': 'Orbit', 'Sepi': 'Quiet', 'Normal': 'Normal', 'Padat': 'Busy', 'Macet': 'Jammed',
  'Mati': 'Off', 'Nyala': 'On', 'Aktif (tol padat pemudik, truk besar dilarang)': 'On (toll roads full of travellers, heavy trucks banned)', 'Cerah': 'Clear', 'Berawan': 'Cloudy', 'Hujan': 'Rain', 'Kabut': 'Fog',
  'Sesuai aslinya (OpenStreetMap)': 'As in reality (OpenStreetMap)', 'Lebih berkelok & berbukit': 'More bends & hills', 'Lebih lurus': 'Straighter', 'Jauh (lebih berat)': 'Far (heavier)', 'Hemat (paling ringan)': 'Saver (lightest)',
  'Sedang': 'Medium', 'Tinggi (paling realistis)': 'High (most realistic)', 'Manual (kopling otomatis) · , dan . ganti gigi': 'Manual (auto clutch) · , and . change gear', 'Manual + kopling (Spasi)': 'Manual + clutch (Space)',
  'Aktif (miringkan HP seperti setir)': 'On (tilt the phone like a wheel)', 'Nyala (penyiar & iklan fiktif, Y)': 'On (fictional DJ & ads, Y)', 'Aktif (gas & rem tetap manual)': 'On (you keep gas & brake)', 'Nyala (pemandu suara)': 'On (spoken directions)',
  'Ringkas (lebih kecil, tekan G)': 'Compact (smaller, press G)', 'Pagi 07:00': 'Morning 07:00', 'Siang 12:00': 'Noon 12:00', 'Sore 17:48': 'Evening 17:48', 'Malam 21:00': 'Night 21:00',
  'Mati (setir penuh, harus balas setir)': 'Off (full steering, counter-steer yourself)', 'Aktif (mobil lurus lagi saat setir dilepas)': 'On (the car straightens when you let go)', 'Berhenti': 'Stopped',
  '1 jam = 60 menit (waktu nyata)': '1 hour = 60 minutes (real time)', '1 jam = 2 menit': '1 hour = 2 minutes', '1 jam = 1 menit': '1 hour = 1 minute', '1 jam = 10 detik': '1 hour = 10 seconds', 'Sesuai data': 'As in the data',
  'Untuk arah saya': 'For my direction', 'Untuk arah lawan': 'For the other direction', 'Semua (one way)': 'All (one way)', 'Nyata 1:1': 'Real 1:1', 'Ringkas 1:5': 'Compact 1:5', 'Cepat 1:20': 'Fast 1:20',
  'Isi formulir saran': 'Fill in the feedback form', 'Laporkan bug (F9)': 'Report a bug (F9)', 'Bahasa': 'Language',
  // garage, career, account, photo, bug report
  'Garasi & Karier': 'Garage & Career', 'Karier': 'Career', 'Misi harian': 'Daily missions', 'Akun & simpan': 'Account & save', 'Pakai': 'Use', 'Sedang dipakai': 'In use', 'Dipakai': 'In use', 'Milik Anda': 'Yours',
  'Pencapaian': 'Achievements', 'Selesai': 'Done', 'Simpan sekarang': 'Save now', 'Buat simpanan cloud': 'Create a cloud save', 'Salin kunci': 'Copy key', 'Muat dari kunci simpanan': 'Load from a save key', 'Muat & mulai ulang': 'Load & restart',
  'Kunci simpanan (tanpa akun)': 'Save key (without an account)', 'Belum masuk akun': 'Not signed in', 'Kelola akun': 'Manage account', 'Akun driving.7mit': 'driving.7mit account', 'Masuk dengan Google': 'Sign in with Google',
  'atau dengan email': 'or with email', 'Masuk': 'Sign in', 'Daftar': 'Sign up', 'Email': 'Email', 'Kata sandi': 'Password', 'Nama pemain': 'Player name', 'Buat akun': 'Create account', 'Lupa kata sandi?': 'Forgot password?',
  'Kirim tautan atur ulang': 'Send reset link', 'Keluar dari akun': 'Sign out', 'Multiplayer wajib masuk akun dulu.': 'Multiplayer needs an account: sign in first.',
  'Buat akun untuk menyimpan semua progres driving.7mit ke server dan bermain multiplayer.': 'Create an account to keep all your driving.7mit progress on the server and to play multiplayer.',
  'Jarak': 'Distance', 'Tinggi': 'Height', 'Lensa': 'Lens', 'Jam': 'Time', 'Simpan foto': 'Save photo', 'Bagikan': 'Share', 'Hangat': 'Warm', 'Dingin': 'Cool', 'Sinema': 'Cinema', 'Vintage': 'Vintage', 'Hitam putih': 'Black & white',
  'Geser layar untuk memutar kamera · gulir / cubit untuk zoom': 'Drag to orbit · scroll / pinch to zoom', 'REPLAY': 'REPLAY',
  'Laporkan bug': 'Report a bug', 'Apa yang terjadi?': 'What happened?', 'Sertakan tangkapan layar game': 'Include a screenshot of the game', 'Sertakan info perangkat, pengaturan, posisi dan log error': 'Include device info, settings, position and error log',
  'Kirim laporan': 'Send report', 'Unduh laporan': 'Download report',
  'Jalan': 'Road', 'km/jam': 'km/h', 'Terima kasih! Laporan sudah terkirim ke tim driving.7mit.': 'Thank you! Your report has been sent to the driving.7mit team.', 'Mengirim…': 'Sending…',
  'Tuliskan dulu apa yang terjadi.': 'Please describe what happened first.', 'Laporan bug terkirim': 'Bug report sent', 'Sebentar…': 'One moment…', 'Email tidak valid': 'Invalid email', 'Kata sandi minimal 6 karakter': 'The password needs at least 6 characters',
  'Email atau kata sandi salah': 'Wrong email or password', 'Progres tersimpan ke akun': 'Progress saved to your account', 'Keluar dari akun': 'Sign out', 'Foto disimpan': 'Photo saved', 'Kendaraan perusahaan dikembalikan': 'Company vehicle returned',
  'Data OpenStreetMap belum bisa dimuat (internet/server sibuk) · memakai data bawaan': 'OpenStreetMap data could not be loaded yet (internet/server busy) · using built-in data',
  'Kemudi manual: bebas, pelanggaran tetap dicatat': 'Manual driving: free, offences are still recorded', 'Radio mati': 'Radio off', 'Radio 7MIT FM 97,7 menyala': 'Radio 7MIT FM 97.7 on', 'Transmisi otomatis': 'Automatic gearbox',
  'Gamepad / setir terhubung': 'Gamepad / wheel connected', 'Belum ada rekaman: berkendara dulu beberapa detik': 'Nothing recorded yet: drive for a few seconds first', 'Mode mudik dimatikan': 'Homecoming mode off',
};
// patterns for text with numbers and names in it
export const PATTERNS = [
  [/^\+(Rp [\d.]+) · berkendara 1–2 menit$/, '+$1 · driving 1–2 minutes'], [/^\+(Rp [\d.]+) · berkendara 5 menit$/, '+$1 · driving 5 minutes'], [/^\+(Rp [\d.]+) · menempuh 2 km$/, '+$1 · 2 km driven'],
  [/^Tap e-Toll (.+) · Rp ([\d.]+) · sisa saldo (.+)$/, 'e-Toll tap $1 · Rp $2 · balance $3'], [/^Tap masuk (.+)$/, 'Toll entry $1'], [/^Pelanggaran: (.+)$/, 'Offence: $1'],
  [/^Kendaraan: (.+)$/, 'Vehicle: $1'], [/^Kamera: (.+)$/, 'Camera: $1'], [/^Cuaca: (.+)$/, 'Weather: $1'], [/^Grafis: (.+)$/, 'Graphics: $1'], [/^Jam game diatur ke (.+)$/, 'Game time set to $1'],
  [/^Naik level (\d+) · (.+)$/, 'Level up $1 · $2'], [/^Pencapaian: (.+)$/, 'Achievement: $1'], [/^Misi selesai: (.+)$/, 'Mission done: $1'], [/^Masuk sebagai (.+)$/, 'Signed in as $1'],
  [/^Uang tunai (Rp [\d.,]+ (?:jt)?)\./, 'Cash $1.'], [/^(\d+) km\/j maks/, '$1 km/h top'], [/^Beli (Rp .+)$/, 'Buy $1'], [/^Perlu level (\d+)$/, 'Needs level $1'],
  [/^Mesin \+1 · (.+)$/, 'Engine +1 · $1'], [/^Ban \+1 · (.+)$/, 'Tyres +1 · $1'], [/^Rem \+1 · (.+)$/, 'Brakes +1 · $1'], [/^(Mesin|Ban|Rem) maks$/, m => ({Mesin: 'Engine', Ban: 'Tyres', Rem: 'Brakes'}[m.split(' ')[0]] + ' max')],
  [/^Tempuh (\d+) km$/, 'Drive $1 km'], [/^Selesaikan (\d+) order pekerjaan$/, 'Finish $1 job orders'], [/^Lewati (\d+) gerbang tol \(tap e-Toll\)$/, 'Pass $1 toll gates (e-Toll tap)'],
  [/^Berkendara (\d+) km tanpa pelanggaran$/, 'Drive $1 km without offences'], [/^Tempuh (\d+) km di malam hari$/, 'Drive $1 km at night'], [/^Tempuh (\d+) km saat hujan$/, 'Drive $1 km in the rain'],
  [/^Pulau (.+) · Lajur kiri$/, '$1 · Keep left'], [/^Pulau (\S+)$/, '$1'],
  [/^Sinkron otomatis$/, 'Auto sync'], [/^Lajur (\d)$/, 'Lane $1'], [/^(\d) lajur$/, '$1 lanes'], [/^Akun: (.+)$/, 'Account: $1'],
];
const ATTRS = ['title', 'aria-label', 'placeholder'];
export function translate(t){ const s = t.trim(); if (!s) return null; const d = DICT[s]; if (d != null) return t.replace(s, d);
  if (/^[\d\s.,:%+−\-–/]*$/.test(s)) return null;
  for (const [re, to] of PATTERNS) if (re.test(s)) return t.replace(s, typeof to === 'function' ? to(s) : s.replace(re, to));
  return null; }
function walk(root){
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = root; n; n = tw.nextNode()) {
    if (n.nodeType === 3) { const p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) continue; const r = translate(n.nodeValue); if (r != null && r !== n.nodeValue) n.nodeValue = r; }
    else if (n.nodeType === 1) for (const a of ATTRS) { const v = n.getAttribute && n.getAttribute(a); if (v) { const r = translate(v); if (r != null && r !== v) n.setAttribute(a, r); } } }
}
let obs = null;
export function startI18n(){
  if (getLang() !== 'en' || obs) return; document.documentElement.lang = 'en'; walk(document.body);
  obs = new MutationObserver(list => { for (const m of list) {
    if (m.type === 'characterData') { const r = translate(m.target.nodeValue); if (r != null && r !== m.target.nodeValue) m.target.nodeValue = r; }
    else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); const r = v && translate(v); if (r != null && r !== v) m.target.setAttribute(m.attributeName, r); }
    else for (const n of m.addedNodes) if (n.nodeType === 1) walk(n); else if (n.nodeType === 3) { const r = translate(n.nodeValue); if (r != null && r !== n.nodeValue) n.nodeValue = r; } } });
  obs.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS});
}
// switching language: English starts translating right away; going back to Indonesian reloads the page (the original text)
export function setLang(l){ try { localStorage.setItem(KEY, l); } catch (e) {} if (l === 'en') startI18n(); else location.reload(); }
