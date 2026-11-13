// INADigital: the government-services app that is installed on the in-game phone from the start.
// An in-game SIMULATION (not the official app): a digital-identity card, a service catalogue with requests that move through verification,
// shortcuts to the game's real public-service numbers (151, 133, 110, 112, 119), a history and an account page.
// Looks follow the INA Digital Design System (design.inadigital.go.id): Inter, the blue scale, brand red, neutral grey, spacing of 2/4/8/12/16/24/32,
// buttons 44-48 px high, "focused" shadows on cards, "float" shadows on overlays, chips, badges, stepper, accordion, toggle and empty-state patterns.

export const INA_CATS = [
  ['identitas', 'Identitas', 'CreditCard'], ['kesehatan', 'Kesehatan', 'HeartPulse'], ['pendidikan', 'Pendidikan', 'GraduationCap'], ['pajak', 'Pajak', 'Landmark'],
  ['transportasi', 'Transportasi', 'Car'], ['sosial', 'Sosial', 'HandHeart'], ['usaha', 'Perizinan', 'Briefcase'], ['lapor', 'Lapor', 'Megaphone']];
// game: the in-game service number that a service dials (the same dispatchers as the phone's "Nomor penting")
export const INA_SERVICES = [
  {id: 'inapas', cat: 'identitas', name: 'Aktivasi INA PAS', org: 'INA Digital', icon: 'Fingerprint', desc: 'Satu identitas digital untuk masuk ke layanan pemerintah, lengkap dengan verifikasi berlapis.', steps: ['Isi data diri', 'Verifikasi wajah', 'Atur kode keamanan', 'Identitas aktif'], docs: ['Nomor identitas', 'Nomor ponsel aktif']},
  {id: 'ktp', cat: 'identitas', name: 'KTP Digital', org: 'Dukcapil', icon: 'CreditCard', desc: 'Ajukan KTP digital di ponsel dan cetak ulang bila hilang.', steps: ['Isi permohonan', 'Verifikasi data', 'Rekam biometrik', 'KTP digital aktif'], docs: ['Kartu Keluarga', 'Pas foto terbaru', 'Surat kehilangan (bila hilang)']},
  {id: 'kk', cat: 'identitas', name: 'Perubahan Kartu Keluarga', org: 'Dukcapil', icon: 'Users', desc: 'Tambah anggota keluarga atau perbarui data pada Kartu Keluarga.', steps: ['Pilih jenis perubahan', 'Unggah berkas', 'Verifikasi petugas', 'KK terbit'], docs: ['KK lama', 'Akta kelahiran atau nikah']},
  {id: 'jkn', cat: 'kesehatan', name: 'Cek Kepesertaan JKN', org: 'Kesehatan', icon: 'ShieldCheck', desc: 'Lihat status kepesertaan jaminan kesehatan dan fasilitas kesehatan tingkat pertama Anda.', steps: ['Masukkan nomor kartu', 'Verifikasi', 'Status tampil'], docs: ['Nomor kartu peserta']},
  {id: 'imun', cat: 'kesehatan', name: 'Riwayat Imunisasi', org: 'Kesehatan', icon: 'Syringe', desc: 'Catatan imunisasi keluarga di satu tempat, siap ditunjukkan di fasilitas kesehatan.', steps: ['Pilih anggota keluarga', 'Sinkron data', 'Riwayat tampil'], docs: ['Identitas anggota keluarga']},
  {id: 'faskes', cat: 'kesehatan', name: 'Fasilitas Kesehatan Terdekat', org: 'Kemenkes 119', icon: 'Hospital', desc: 'Tanyakan fasilitas kesehatan terdekat dari posisi Anda lewat layanan 119.', game: ['119', 'Hubungi 119']},
  {id: 'beasiswa', cat: 'pendidikan', name: 'Beasiswa Pendidikan', org: 'INA Digital Edu', icon: 'GraduationCap', desc: 'Temukan dan ajukan beasiswa sesuai jenjang pendidikan.', steps: ['Pilih jenjang', 'Lengkapi berkas', 'Seleksi administrasi', 'Pengumuman'], docs: ['Rapor atau transkrip', 'Surat keterangan', 'Identitas orang tua']},
  {id: 'guru', cat: 'pendidikan', name: 'Pelatihan dan Sertifikat Guru', org: 'INA Digital Edu', icon: 'BookOpen', desc: 'Ikuti pelatihan daring dan simpan sertifikat di akun Anda.', steps: ['Pilih pelatihan', 'Daftar', 'Ikuti sesi', 'Sertifikat terbit'], docs: ['Nomor induk pendidik']},
  {id: 'pbb', cat: 'pajak', name: 'Pajak Bumi dan Bangunan', org: 'Pajak Daerah', icon: 'Landmark', desc: 'Cek tagihan dan bayar pajak bumi dan bangunan.', steps: ['Masukkan nomor objek', 'Cek tagihan', 'Pilih pembayaran', 'Bukti bayar'], docs: ['Nomor objek pajak']},
  {id: 'pkb', cat: 'pajak', name: 'Pajak Kendaraan', org: 'Samsat', icon: 'Receipt', desc: 'Perpanjang pajak tahunan kendaraan tanpa antre.', steps: ['Masukkan nomor polisi', 'Cek tagihan', 'Bayar', 'Pengesahan digital'], docs: ['Nomor polisi', 'Nomor rangka (5 digit akhir)']},
  {id: 'sim', cat: 'transportasi', name: 'Perpanjangan SIM', org: 'Kepolisian', icon: 'IdCard', desc: 'Ajukan perpanjangan SIM dan pilih jadwal layanan.', steps: ['Pilih jenis SIM', 'Cek kesehatan', 'Pilih jadwal', 'SIM terbit'], docs: ['SIM lama', 'KTP', 'Surat sehat']},
  {id: 'etle', cat: 'transportasi', name: 'Cek Tilang Elektronik', org: 'Kepolisian 110', icon: 'Camera', desc: 'Periksa catatan tilang elektronik (ETLE) atas kendaraan Anda lewat layanan 110.', game: ['110', 'Hubungi 110']},
  {id: 'dishub', cat: 'transportasi', name: 'Dishub: Semua Ruas dan Moda', org: 'Dishub 151', icon: 'TrafficCone', desc: 'Dinas Perhubungan melayani semua ruas jalan, tol dan nasional, serta seluruh moda transportasi.', game: ['151', 'Hubungi 151']},
  {id: 'tol', cat: 'transportasi', name: 'Bantuan Jalan Tol', org: 'Jalan Tol 133', icon: 'Headset', desc: 'Derek gratis dan informasi lalu lintas, khusus ruas jalan tol.', game: ['133', 'Hubungi 133']},
  {id: 'darurat', cat: 'lapor', name: 'Layanan Darurat', org: 'Darurat 112', icon: 'Siren', desc: 'Kecelakaan, kebakaran, atau keadaan darurat lain: ambulans, polisi, pemadam dan SAR.', game: ['112', 'Hubungi 112']},
  {id: 'bansos', cat: 'sosial', name: 'Cek Penerima Bantuan Sosial', org: 'Sosial', icon: 'HandHeart', desc: 'Lihat apakah keluarga Anda terdaftar sebagai penerima bantuan sosial.', steps: ['Masukkan identitas', 'Verifikasi', 'Status tampil'], docs: ['Nomor identitas']},
  {id: 'nib', cat: 'usaha', name: 'Nomor Induk Berusaha', org: 'Perizinan Berusaha', icon: 'Store', desc: 'Daftarkan usaha kecil Anda dan dapatkan nomor induk berusaha.', steps: ['Isi data usaha', 'Pilih bidang usaha', 'Verifikasi', 'NIB terbit'], docs: ['Identitas pemilik', 'Alamat usaha']},
  {id: 'lapor', cat: 'lapor', name: 'Lapor Layanan Publik', org: 'Pengaduan', icon: 'Megaphone', desc: 'Sampaikan pengaduan atau aspirasi tentang layanan publik, dan pantau tindak lanjutnya.', steps: ['Tulis laporan', 'Unggah bukti', 'Ditinjau petugas', 'Tindak lanjut'], docs: ['Uraian kejadian', 'Foto atau dokumen pendukung (opsional)']}];
export const INA_NEWS = [
  ['Layanan 133 dan 151 kini lebih jelas', '133 khusus jalan tol, 151 untuk semua ruas dan moda transportasi.', 'TrafficCone'],
  ['Identitas digital satu pintu', 'Aktifkan INA PAS sekali, masuk ke banyak layanan.', 'Fingerprint'],
  ['Pelatihan guru gratis', 'Ikuti pelatihan daring dari INA Digital Edu dan simpan sertifikatnya.', 'GraduationCap']];

// how far a request has got, by its age in seconds (it is a simulation: verification takes seconds, not days)
export const inaStatus = ageSec => ageSec < 15 ? ['Diterima', 'info'] : ageSec < 40 ? ['Diverifikasi', 'warn'] : ['Selesai', 'ok'];
// a fictional but stable 16-digit identity number from the player's phone number (never a real NIK)
export function inaNik(seed){ let h = 2166136261, out = '31'; for (const c of String(seed || '0')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h >>>= 0;
  while (out.length < 16) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; out += String(h % 10); } return out; }
export const maskNik = n => `${n.slice(0, 4)} •••• •••• ${n.slice(12)}`;
// a pseudo-QR pattern (looks like a code, is not a scannable one) that changes with `seed`
export function qrCells(seed, n = 21){ let h = 2166136261; for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h >>>= 0;
  const cells = [], finder = (x, y) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let on; if (finder(x, y)) { const fx = x < 8 ? x : x - (n - 8), fy = y < 8 ? y : y - (n - 8);
      on = fx < 7 && fy < 7 && (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5)); }
    else { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; on = (h >>> 16) % 100 < 46; } if (on) cells.push([x, y]); } return cells; }
const greet = time => { const h = parseInt(String(time || '12').slice(0, 2), 10); return h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam'; };

const INA_RAW = `
#phone .pg.ina-pg{padding:0;background:#F5F5F5;color:#1F1F1F;font-family:Inter,system-ui,sans-serif;--p:#196BCD;--pd:#0A489F;--pdd:#022A5B;--pl:#C0D7F9;--pt:#EDF8FF;--ink:#1F1F1F;--mut:#737373;--ln:#E5E5E5;--red:#BE0000;--ok:#16A34A;--okt:#DCFCE7;--wn:#C25001;--wnt:#FFEBD4;--info:#0049B8;
  --focus:0 1px 2px rgba(20,20,20,.06),0 4px 14px rgba(0,73,184,.10);--float:0 10px 30px rgba(11,33,72,.22)}
#phone .ina{min-height:100%;display:flex;flex-direction:column;padding-bottom:6px}
#phone .ina::before{content:'';position:sticky;top:0;display:block;flex:none;height:44px;margin-bottom:-44px;background:linear-gradient(#0B2148 50%,rgba(11,33,72,0));z-index:7;pointer-events:none}
#phone .app:has(.ina-pg){background:#F5F5F5}
#phone .app:has(.ina-pg) .stat,#phone.app-open:has(.ina-pg) .stat{background:transparent;color:#fff}
#phone .ina h1,#phone .ina h2,#phone .ina h3,#phone .ina b,#phone .ina summary,#phone .ina .brand{font-family:Inter,system-ui,sans-serif!important;font-style:normal;text-transform:none}
#phone .ina *{box-sizing:border-box} #phone .ina button,#phone .ina input{font-family:inherit;-webkit-tap-highlight-color:transparent}
#phone .ina :focus-visible{outline:2px solid #196BCD;outline-offset:2px}
.ina .hd{position:relative;flex:none;padding:50px 16px 52px;color:#fff;background:linear-gradient(165deg,#0B2148 0%,#0049B8 62%,#0968F6 100%);overflow:hidden;border-radius:0 0 28px 28px}
.ina .hd::before{content:'';position:absolute;right:-50px;top:-40px;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.22),rgba(255,255,255,0) 68%)}
.ina .hd::after{content:'';position:absolute;left:-30px;bottom:-60px;width:150px;height:150px;border-radius:50%;border:26px solid rgba(255,255,255,.06)}
.ina .hd.sm{padding:50px 16px 40px}
.ina .row1{display:flex;align-items:center;gap:8px;position:relative;z-index:1}
.ina .brand{display:flex;align-items:center;gap:6px;font-weight:800;font-size:17px;letter-spacing:-.4px;flex:1} .ina .brand i{width:9px;height:9px;border-radius:50%;background:#FF1800;box-shadow:0 0 0 3px rgba(255,24,0,.25)} .ina .brand span{font-weight:400;opacity:.9}
.ina .ibtn{width:40px;height:40px;border-radius:14px;border:0;background:rgba(255,255,255,.16);color:#fff;display:grid;place-items:center;cursor:pointer;position:relative;backdrop-filter:blur(6px)} .ina .ibtn svg{width:20px;height:20px}
.ina .ibtn b{position:absolute;top:6px;right:6px;min-width:15px;height:15px;border-radius:8px;background:#FF1800;font-size:9px;display:grid;place-items:center;padding:0 3px}
.ina .hi{position:relative;z-index:1;margin-top:16px} .ina .hi small{display:block;font-size:12px;line-height:16px;opacity:.85} .ina .hi h2{margin:2px 0 0;font-size:22px;line-height:28px;font-weight:800;letter-spacing:-.5px}
.ina .srch{position:relative;z-index:2;margin:-24px 16px 0;height:48px;border-radius:16px;background:#fff;box-shadow:var(--float);display:flex;align-items:center;gap:10px;padding:0 14px;color:var(--mut);border:0;width:calc(100% - 32px);text-align:left;font-size:14px;cursor:text}
.ina .srch svg{width:18px;height:18px;flex:none;color:var(--p)} .ina input.srch{color:var(--ink);outline:none}
.ina .sec{padding:0 16px;margin-top:22px;position:relative}
.ina .ov{position:relative;z-index:2} .ina .sec h3{margin:0 0 10px;font-size:16px;line-height:24px;font-weight:700;letter-spacing:-.2px;display:flex;align-items:center;justify-content:space-between} .ina .sec h3 button{border:0;background:none;color:var(--p);font-size:12px;font-weight:600;cursor:pointer;padding:4px 0}
.ina .pas{position:relative;margin:16px 16px 0;border-radius:22px;padding:16px;color:#fff;background:linear-gradient(135deg,#022A5B 0%,#196BCD 70%,#4D93FC 120%);box-shadow:var(--focus),0 12px 24px rgba(2,42,91,.28);overflow:hidden;z-index:2}
.ina .pas::after{content:'';position:absolute;right:-26px;bottom:-34px;width:130px;height:130px;border-radius:50%;border:18px solid rgba(255,255,255,.1)}
.ina .pas .t{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;opacity:.9} .ina .pas .t svg{width:15px;height:15px}
.ina .pas .nm{font-size:18px;line-height:24px;font-weight:800;margin-top:12px;letter-spacing:-.3px;position:relative;z-index:1} .ina .pas .no{font:600 13px/20px ui-monospace,Menlo,monospace;letter-spacing:1.2px;opacity:.92;position:relative;z-index:1}
.ina .pas .ft{display:flex;align-items:center;justify-content:space-between;margin-top:14px;position:relative;z-index:1}
.ina .bdg{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:4px 10px;font-size:11px;line-height:16px;font-weight:600;background:var(--okt);color:#15803D} .ina .bdg svg{width:12px;height:12px}
.ina .bdg.info{background:var(--pt);color:var(--info)} .ina .bdg.warn{background:var(--wnt);color:var(--wn)} .ina .bdg.ok{background:var(--okt);color:#15803D} .ina .bdg.dk{background:rgba(255,255,255,.18);color:#fff}
.ina .btn{height:44px;border-radius:12px;border:0;padding:0 16px;font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;background:var(--p);color:#fff;transition:transform .15s,background .15s;width:100%}
.ina .btn:hover{background:var(--pd)} .ina .btn:active{background:var(--pdd);transform:scale(.98)} .ina .btn svg{width:18px;height:18px}
.ina .btn.sec{background:#fff;color:var(--p);box-shadow:inset 0 0 0 1.5px var(--p)} .ina .btn.sec:hover{background:var(--pt)} .ina .btn.sm{height:32px;width:auto;font-size:12px;padding:0 12px;border-radius:10px} .ina .btn.lt{background:#fff;color:#022A5B}
.ina .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 6px}
.ina .tile{border:0;background:none;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;line-height:14px;font-weight:600;color:var(--ink);cursor:pointer;padding:0}
.ina .tile i,.ina .ico{width:52px;height:52px;border-radius:18px;display:grid;place-items:center;background:#fff;color:var(--p);box-shadow:var(--focus);border:1px solid var(--ln);transition:transform .2s} .ina .tile:active i{transform:scale(.92)} .ina .tile svg,.ina .ico svg{width:24px;height:24px}
.ina .tile:nth-child(8n+2) i{color:#D50B0B;background:#FEF2F2} .ina .tile:nth-child(8n+3) i{color:#16A34A;background:#DCFCE7} .ina .tile:nth-child(8n+4) i{color:#C25001;background:#FFEBD4} .ina .tile:nth-child(8n+5) i{color:#0049B8;background:#EDF8FF}
.ina .tile:nth-child(8n+6) i{color:#DE1D5E;background:#FDCDE3} .ina .tile:nth-child(8n+7) i{color:#2663A3;background:#D4E5FE} .ina .tile:nth-child(8n+8) i{color:#D69009;background:#FBF38C}
.ina .card{background:#fff;border-radius:18px;border:1px solid var(--ln);box-shadow:var(--focus);overflow:hidden}
.ina .li{display:flex;align-items:center;gap:12px;padding:12px;width:100%;border:0;background:none;text-align:left;cursor:pointer;color:var(--ink);min-height:64px} .ina .li+.li{border-top:1px solid var(--ln)} .ina .li:active{background:var(--pt)}
.ina .li .ico{width:44px;height:44px;border-radius:14px;box-shadow:none;background:var(--pt);border:0;flex:none} .ina .li .tx{flex:1;min-width:0} .ina .li b{display:block;font-size:14px;line-height:20px;font-weight:600} .ina .li small{display:block;font-size:12px;line-height:16px;color:var(--mut)} .ina .li>svg{width:18px;height:18px;color:var(--mut);flex:none}
.ina .hs{display:flex;gap:12px;overflow-x:auto;margin:0 -16px;padding:2px 16px 12px;scroll-snap-type:x mandatory;scrollbar-width:none} .ina .hs::-webkit-scrollbar{display:none}
.ina .news{flex:0 0 232px;scroll-snap-align:start;background:#fff;border-radius:18px;border:1px solid var(--ln);box-shadow:var(--focus);overflow:hidden}
.ina .news .im{height:84px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#0049B8,#4D93FC)} .ina .news:nth-child(2) .im{background:linear-gradient(135deg,#B42B2D,#ED7C7E)} .ina .news:nth-child(3) .im{background:linear-gradient(135deg,#15803D,#4ADE80)} .ina .news .im svg{width:34px;height:34px}
.ina .news div:last-child{padding:12px} .ina .news b{display:block;font-size:14px;line-height:20px} .ina .news p{margin:4px 0 0;font-size:12px;line-height:16px;color:var(--mut);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ina .chips{display:flex;gap:8px;overflow-x:auto;padding:0 16px 4px;scrollbar-width:none} .ina .chips::-webkit-scrollbar{display:none}
.ina .chip{flex:none;height:34px;border-radius:999px;border:1px solid var(--ln);background:#fff;padding:0 14px;font-size:12px;font-weight:600;color:var(--ink);cursor:pointer} .ina .chip.on{background:var(--p);border-color:var(--p);color:#fff}
.ina .empty{text-align:center;padding:36px 24px;color:var(--mut)} .ina .empty .ico{margin:0 auto 14px;width:76px;height:76px;border-radius:50%;background:var(--pt);border:0;box-shadow:none} .ina .empty .ico svg{width:34px;height:34px} .ina .empty b{display:block;color:var(--ink);font-size:16px;line-height:24px} .ina .empty p{margin:4px 0 16px;font-size:13px;line-height:20px}
.ina .tabs{position:sticky;bottom:10px;margin:auto 10px 0;flex:none;height:62px;border-radius:22px;background:rgba(255,255,255,.96);backdrop-filter:blur(14px);box-shadow:var(--float);display:grid;grid-template-columns:repeat(4,1fr);padding:6px;z-index:6;border:1px solid var(--ln)}
.ina .tabs button{border:0;background:none;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:10px;line-height:12px;font-weight:600;color:var(--mut);cursor:pointer;transition:background .2s,color .2s} .ina .tabs button svg{width:21px;height:21px} .ina .tabs button.on{background:var(--pt);color:var(--p)}
.ina .top{display:flex;align-items:center;gap:10px;position:relative;z-index:1} .ina .top h2{margin:0;font-size:18px;line-height:24px;font-weight:800;flex:1;letter-spacing:-.3px}
.ina .dh{padding:14px 16px 0} .ina .dh .ico{width:60px;height:60px;border-radius:20px;margin-bottom:12px} .ina .dh h2{margin:8px 0 2px;font-size:20px;line-height:28px;font-weight:800;letter-spacing:-.4px} .ina .dh p{margin:6px 0 0;font-size:13px;line-height:20px;color:#525252}
.ina .alert{display:flex;gap:10px;border-radius:14px;padding:12px;background:var(--pt);color:#022A5B;font-size:12px;line-height:18px;margin:14px 16px 0;border:1px solid var(--pl)} .ina .alert svg{width:18px;height:18px;flex:none;color:var(--info);margin-top:1px}
.ina .stp{list-style:none;margin:0;padding:14px 14px 4px} .ina .stp li{position:relative;padding:0 0 18px 40px;font-size:13px;line-height:20px;font-weight:600} .ina .stp li::before{content:attr(data-n);position:absolute;left:0;top:-2px;width:28px;height:28px;border-radius:50%;background:var(--pt);color:var(--p);display:grid;place-items:center;font-size:12px;font-weight:800;border:1.5px solid var(--pl)}
.ina .stp li::after{content:'';position:absolute;left:13.5px;top:28px;bottom:2px;width:1.5px;background:var(--pl)} .ina .stp li:last-child::after{display:none} .ina .stp li.done::before{content:'✓';background:var(--p);color:#fff;border-color:var(--p)} .ina .stp li.done::after{background:var(--p)}
.ina details{border-top:1px solid var(--ln)} .ina details:first-of-type{border-top:0} .ina summary{list-style:none;display:flex;align-items:center;justify-content:space-between;padding:14px;font-size:14px;font-weight:600;cursor:pointer;min-height:48px} .ina summary::-webkit-details-marker{display:none} .ina summary svg{width:18px;height:18px;color:var(--mut);transition:transform .25s} .ina details[open] summary svg{transform:rotate(180deg)}
.ina details ul{margin:0;padding:0 14px 14px 32px;font-size:13px;line-height:22px;color:#525252}
.ina .cta{position:sticky;bottom:0;margin-top:auto;padding:12px 16px 16px;background:linear-gradient(transparent,#F5F5F5 28%);display:grid;gap:8px;margin-top:8px;z-index:5}
.ina .ok-hero{text-align:center;padding:54px 24px 8px} .ina .ok-hero .ck{width:92px;height:92px;border-radius:50%;margin:0 auto 18px;display:grid;place-items:center;background:var(--okt);color:#15803D;animation:inaPop .6s cubic-bezier(.2,1.4,.4,1) both} .ina .ok-hero .ck svg{width:46px;height:46px;stroke-width:2.5}
.ina .ok-hero h2{margin:0;font-size:22px;line-height:28px;font-weight:800} .ina .ok-hero p{margin:6px 0 0;font-size:13px;line-height:20px;color:#525252}
.ina .tk{margin:18px 16px 0;padding:14px;border-radius:16px;background:#fff;border:1px dashed var(--pl);text-align:center} .ina .tk small{display:block;font-size:11px;color:var(--mut)} .ina .tk b{font:700 18px/28px ui-monospace,Menlo,monospace;letter-spacing:1.5px;color:var(--pdd)}
.ina .qrw{margin:20px 16px 0;padding:20px;border-radius:24px;background:#fff;box-shadow:var(--float);text-align:center} .ina .qrw svg{width:206px;height:206px;display:block;margin:0 auto} .ina .qrw p{margin:12px 0 0;font-size:12px;line-height:16px;color:var(--mut)}
.ina .bar{height:6px;border-radius:3px;background:var(--pt);margin:12px 12px 0;overflow:hidden} .ina .bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#196BCD,#4D93FC);transform-origin:left;transition:transform 1s linear}
.ina .acc{display:flex;align-items:center;gap:14px;margin:16px 16px 0;padding:14px;border-radius:20px;background:#fff;border:1px solid var(--ln);box-shadow:var(--focus)} .ina .av{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#0049B8,#4D93FC);color:#fff;display:grid;place-items:center;font-size:20px;font-weight:800;flex:none} .ina .acc b{display:block;font-size:16px;line-height:24px} .ina .acc small{display:block;font-size:12px;color:var(--mut)}
.ina .tg{position:relative;width:46px;height:28px;border-radius:14px;border:0;background:#D4D4D4;cursor:pointer;flex:none;transition:background .2s} .ina .tg::after{content:'';position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s} .ina .tg[aria-checked=true]{background:var(--p)} .ina .tg[aria-checked=true]::after{transform:translateX(18px)}
.ina .note{margin:20px 16px 0;font-size:11px;line-height:16px;color:var(--mut);text-align:center} .ina .note a{color:var(--p);font-weight:600}
.ina .rise>*{animation:inaRise .5s cubic-bezier(.2,.9,.3,1) both} .ina .rise>*:nth-child(2){animation-delay:.05s} .ina .rise>*:nth-child(3){animation-delay:.1s} .ina .rise>*:nth-child(4){animation-delay:.15s} .ina .rise>*:nth-child(5){animation-delay:.2s} .ina .rise>*:nth-child(6){animation-delay:.25s}
@keyframes inaRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}} @keyframes inaPop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
@media(prefers-reduced-motion:reduce){.ina .rise>*,.ina .ok-hero .ck{animation:none}.ina .bar i{transition:none}}
`;
// every rule is scoped under #phone so it beats the phone's own generic .btn / .card / .row / h2 styles
export const INA_CSS = INA_RAW.replace(/(^|\}|,|\{)(\s*)\.ina\b/g, '$1$2#phone .ina');

// what the phone gives the app: A (the game), P (saved phone settings), save, esc, ic, push, back, redraw, dial (a call to a service number), notify
export function createInaDigital({A, P, save, esc, ic, push, back, redraw, dial, notify}){
  P.ina = P.ina || {}; const S = P.ina; S.hist = Array.isArray(S.hist) ? S.hist : []; S.mfa = S.mfa !== false; S.notif = S.notif !== false;
  let tab = 'beranda', query = '', cat = 'semua';
  const svc = id => INA_SERVICES.find(s => s.id === id), owner = () => String(P.owner || 'Pengemudi 7MIT'), nik = () => inaNik(P.no || owner());
  const catName = id => (INA_CATS.find(c => c[0] === id) || [0, 'Layanan'])[1];
  const row = s => `<button class="li" data-svc="${s.id}"><span class="ico">${ic(s.icon)}</span><span class="tx"><b>${esc(s.name)}</b><small>${esc(s.org)} · ${esc(catName(s.cat))}</small></span>${ic('ChevronRight')}</button>`;
  const tabs = t => `<nav class="tabs" role="tablist" aria-label="Menu INADigital">${[['beranda', 'Beranda', 'Home'], ['layanan', 'Layanan', 'LayoutGrid'], ['riwayat', 'Riwayat', 'History'], ['akun', 'Akun', 'User']]
    .map(([k, l, i]) => `<button role="tab" aria-selected="${k === t}" class="${k === t ? 'on' : ''}" data-tab="${k}">${ic(i)}${l}</button>`).join('')}</nav>`;
  const age = h => (Date.now() - h.t)/1000, pending = () => S.hist.filter(h => age(h) < 40).length;
  const brand = right => `<div class="row1"><div class="brand"><i></i>INA<span>Digital</span></div>${right}</div>`;

  function home(){ const st = A.state(), first = owner().split(' ')[0];
    return `<div class="hd">${brand(`<button class="ibtn" data-tab="riwayat" aria-label="Notifikasi">${ic('Bell')}${pending() ? `<b>${pending()}</b>` : ''}</button>`)}
      <div class="hi"><small>Selamat ${greet(st.time)}</small><h2>${esc(first)}</h2></div></div>
      <button class="srch" data-tab="layanan" data-focus="1" aria-label="Cari layanan publik">${ic('Search')}Cari layanan publik</button>
      <div class="rise"><div class="pas"><div class="t">${ic('ShieldCheck')}INA PAS · Identitas Digital</div><div class="nm">${esc(owner())}</div><div class="no">${maskNik(nik())}</div>
        <div class="ft"><span class="bdg dk">${ic('Check')}Terverifikasi</span><button class="btn lt sm" data-qr="1">${ic('QrCode')}Tampilkan kode</button></div></div>
      <div class="sec"><h3>Layanan populer<button data-tab="layanan">Lihat semua</button></h3><div class="grid">${INA_CATS.map(([k, l, i]) => `<button class="tile" data-cat="${k}"><i>${ic(i)}</i>${l}</button>`).join('')}</div></div>
      <div class="sec"><h3>Layanan lalu lintas dan darurat</h3><div class="card">${['dishub', 'tol', 'etle', 'darurat'].map(id => row(svc(id))).join('')}</div></div>
      <div class="sec"><h3>Kabar terbaru</h3><div class="hs">${INA_NEWS.map(([t, d, i]) => `<article class="news"><div class="im">${ic(i)}</div><div><b>${esc(t)}</b><p>${esc(d)}</p></div></article>`).join('')}</div></div>
      <p class="note">Aplikasi simulasi di dalam game. Desain mengikuti INA Digital Design System.</p></div>`; }
  const list = () => { const q = query.trim().toLocaleLowerCase('id-ID'), r = INA_SERVICES.filter(s => (cat === 'semua' || s.cat === cat) && (!q || `${s.name} ${s.org} ${catName(s.cat)}`.toLocaleLowerCase('id-ID').includes(q)));
    return r.length ? `<div class="card">${r.map(row).join('')}</div>` : `<div class="empty"><div class="ico">${ic('SearchX')}</div><b>Layanan tidak ditemukan</b><p>Coba kata kunci lain atau pilih kategori yang berbeda.</p><button class="btn sec" data-reset="1">Hapus pencarian</button></div>`; };
  function layanan(){ return `<div class="hd sm"><div class="top"><h2>Layanan</h2></div></div>
    <label class="srch" style="cursor:text">${ic('Search')}<input class="srch-in" style="border:0;outline:0;flex:1;font-size:14px;background:none;min-width:0" placeholder="Cari layanan, instansi…" value="${esc(query)}" maxlength="60" aria-label="Cari layanan"></label>
    <div class="chips" style="margin-top:14px">${[['semua', 'Semua']].concat(INA_CATS.map(c => [c[0], c[1]])).map(([k, l]) => `<button class="chip ${cat === k ? 'on' : ''}" data-cat="${k}">${l}</button>`).join('')}</div>
    <div class="sec rise" style="margin-top:14px"><div class="lst">${list()}</div></div>`; }
  function riwayat(){ const st = h => inaStatus(age(h));
    return `<div class="hd sm"><div class="top"><h2>Riwayat pengajuan</h2></div></div><div class="sec ov rise" style="margin-top:-14px">${S.hist.length
      ? `<div class="card">${S.hist.map(h => { const [l, c] = st(h); return `<div class="li" style="cursor:default"><span class="ico">${ic((svc(h.sid) || {}).icon || 'FileText')}</span><span class="tx"><b>${esc(h.name)}</b><small>${esc(h.no)} · ${esc(h.when)}</small></span><span class="bdg ${c}">${l}</span></div>`; }).join('')}</div>`
      : `<div class="card"><div class="empty"><div class="ico">${ic('FileText')}</div><b>Belum ada pengajuan</b><p>Pengajuan layanan Anda akan muncul di sini beserta statusnya.</p><button class="btn" data-tab="layanan">${ic('LayoutGrid')}Jelajahi layanan</button></div></div>`}</div>`; }
  function akun(){ const t = (k, l, d, i) => `<div class="li" style="cursor:default"><span class="ico">${ic(i)}</span><span class="tx"><b>${l}</b><small>${d}</small></span><button class="tg" role="switch" aria-checked="${!!S[k]}" aria-label="${l}" data-tg="${k}"></button></div>`;
    return `<div class="hd sm"><div class="top"><h2>Akun</h2></div></div><div class="rise"><div class="acc" style="margin-top:-18px;position:relative;z-index:2"><span class="av">${esc(owner().trim()[0] || 'P').toUpperCase()}</span><div><b>${esc(owner())}</b><small>${maskNik(nik())}</small><span class="bdg" style="margin-top:6px">${ic('ShieldCheck')}INA PAS Level 2</span></div></div>
      <div class="sec"><h3>Keamanan</h3><div class="card">${t('mfa', 'Verifikasi berlapis', 'Minta kode saat masuk', 'Lock')}${t('notif', 'Notifikasi pengajuan', 'Kabar status layanan', 'Bell')}</div></div>
      <div class="sec"><h3>Bantuan</h3><div class="card"><a class="li" style="text-decoration:none" href="https://inadigital.go.id/" target="_blank" rel="noopener"><span class="ico">${ic('Globe')}</span><span class="tx"><b>Situs INA Digital</b><small>inadigital.go.id</small></span>${ic('ExternalLink')}</a>
        <a class="li" style="text-decoration:none" href="https://design.inadigital.go.id/getting-started/overview/" target="_blank" rel="noopener"><span class="ico">${ic('Palette')}</span><span class="tx"><b>INA Digital Design System</b><small>design.inadigital.go.id</small></span>${ic('ExternalLink')}</a></div></div>
      <p class="note">Ini aplikasi simulasi di dalam game 7MIT, bukan aplikasi resmi. Nama, nomor identitas, dan semua data di dalamnya fiktif.</p></div>`; }
  const views = {beranda: home, layanan, riwayat, akun};
  // one page for the four tabs; a tap on a tab redraws it
  function render(pg){ pg.classList.add('ina-pg'); pg.innerHTML = `<div class="ina">${views[tab]()}${tabs(tab)}</div>`;
    const R = pg.querySelector('.ina'); R.addEventListener('click', e => { const b = e.target.closest('[data-tab],[data-svc],[data-cat],[data-qr],[data-tg],[data-reset]'); if (!b) return; A.sfx('tap');
      if (b.dataset.tab) { tab = b.dataset.tab; if (b.dataset.focus) setTimeout(() => { const i = document.querySelector('#phone .srch-in'); if (i) i.focus(); }, 60); return redraw(); }
      if (b.dataset.svc) return push(detail(b.dataset.svc));
      if (b.dataset.cat) { cat = b.dataset.cat; tab = 'layanan'; return redraw(); }
      if (b.dataset.qr) return push(qr);
      if (b.dataset.reset) { query = ''; cat = 'semua'; return redraw(); }
      if (b.dataset.tg) { S[b.dataset.tg] = !S[b.dataset.tg]; save(); return redraw(); } });
    const inp = R.querySelector('.srch-in'); if (inp) inp.addEventListener('input', () => { query = inp.value; R.querySelector('.lst').innerHTML = list(); }); }
  const shell = (title, body, foot) => pg => { pg.classList.add('ina-pg'); pg.innerHTML = `<div class="ina"><div class="hd sm"><div class="top"><button class="ibtn" data-back aria-label="Kembali">${ic('ChevronLeft')}</button><h2>${esc(title)}</h2></div></div>${body}${foot || ''}</div>`; return pg.querySelector('.ina'); };
  function detail(id){ const s = svc(id); return pg => { const gm = s.game, R = shell(s.name, `<div class="dh"><div class="ico" style="background:#fff;box-shadow:var(--focus);color:var(--p);margin-top:-30px;position:relative">${ic(s.icon)}</div><span class="bdg info">${esc(catName(s.cat))}</span><h2>${esc(s.name)}</h2><small style="color:#737373;font-size:12px">${esc(s.org)}</small><p>${esc(s.desc)}</p></div>
      ${gm ? `<div class="alert">${ic('Info')}<span>Layanan ini tersambung ke game: panggilan diterima petugas, dan bantuan dikirim ke lokasi Anda.</span></div>`
        : `<div class="sec" style="margin-top:18px"><h3>Alur layanan</h3><div class="card"><ol class="stp">${s.steps.map((t, i) => `<li data-n="${i + 1}">${esc(t)}</li>`).join('')}</ol></div></div>
           <div class="sec"><h3>Persyaratan</h3><div class="card"><details open><summary>Dokumen yang disiapkan${ic('ChevronDown')}</summary><ul>${s.docs.map(d => `<li>${esc(d)}</li>`).join('')}</ul></details></div></div>`}
      <div class="cta"><button class="btn" data-go="1">${gm ? ic('Phone') + gm[1] : ic('Send') + 'Ajukan sekarang'}</button></div>`)(pg);
      R.querySelector('[data-go]').onclick = () => { A.sfx('tap'); if (gm) return dial(gm[0]); submit(s); }; }; }
  function submit(s){ const no = `INA-${String(Date.now()).slice(-6)}${Math.floor(Math.random()*90 + 10)}`; S.hist.unshift({sid: s.id, name: s.name, no, t: Date.now(), when: A.state().time}); S.hist.length = Math.min(S.hist.length, 30); save();
    if (S.notif) setTimeout(() => notify('inadigital', 'Pengajuan diverifikasi', s.name), 20000);
    push(pg => { const R = shell('Pengajuan terkirim', `<div class="ok-hero"><div class="ck">${ic('Check')}</div><h2>Pengajuan terkirim</h2><p>${esc(s.name)} sedang diverifikasi. Statusnya bisa dipantau di Riwayat.</p></div>
      <div class="tk"><small>Nomor pengajuan</small><b>${no}</b></div><div class="cta" style="margin-top:20px"><button class="btn" data-h="1">${ic('History')}Lihat riwayat</button></div>`)(pg);
      R.querySelector('[data-h]').onclick = () => { tab = 'riwayat'; back(); setTimeout(back, 450); }; }); }
  function qr(pg){ const R = shell('Kode INA PAS', `<div class="qrw"><div class="qsvg"></div><div class="bar"><i></i></div><p>Kode berganti tiap 30 detik. Tunjukkan ke petugas untuk verifikasi identitas. Kode simulasi, tidak bisa dipindai.</p></div>
      <div class="sec" style="margin-top:20px"><div class="card"><div class="li" style="cursor:default"><span class="ico">${ic('CreditCard')}</span><span class="tx"><b>${esc(owner())}</b><small>${maskNik(nik())}</small></span><span class="bdg">${ic('Check')}Aktif</span></div></div></div>`)(pg);
    const box = R.querySelector('.qsvg'), bar = R.querySelector('.bar i'); let slot = -1;
    const draw = () => { const sl = Math.floor(Date.now()/30000), left = 30 - (Date.now()/1000 % 30); if (sl !== slot) { slot = sl; const c = qrCells(nik() + ':' + sl);
        box.innerHTML = `<svg viewBox="-1 -1 23 23" role="img" aria-label="Kode simulasi INA PAS" shape-rendering="crispEdges"><rect x="-1" y="-1" width="23" height="23" fill="#fff"/>${c.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1" fill="#0B2148"/>`).join('')}</svg>`; }
      bar.style.transition = 'none'; bar.style.transform = `scaleX(${left/30})`; requestAnimationFrame(() => { bar.style.transition = `transform ${left}s linear`; bar.style.transform = 'scaleX(0)'; }); };
    draw(); const tick = () => setTimeout(() => { if (!pg.isConnected) return; draw(); tick(); }, 30000 - (Date.now() % 30000) + 50); tick(); }
  return {render};
}
