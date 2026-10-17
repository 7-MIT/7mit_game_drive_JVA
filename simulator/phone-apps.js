// Local mini-app catalogue for the simulated phone. No downloads or paid APIs.
const row = (name, kind, description, options = {}) => ({name, kind, description, ...options});
const checklist = (name, items) => row(name, 'checklist', 'Daftar yang bisa dicentang, ditambah, dan disimpan.', {items: items.split('|')});
const note = (name, prompt) => row(name, 'notes', prompt);
const calc = (name, mode, labels, description) => row(name, 'calculator', description, {mode, labels});
const quiz = (name, topic, difficulty = 1) => row(name, 'quiz', 'Latihan interaktif dengan skor dan pembahasan.', {topic, difficulty});
const guide = (name, query) => row(name, 'places', `Cari lokasi ${query} pada jaringan game dan mulai navigasi.`, {query});
const metric = (name, fields) => row(name, 'dashboard', 'Pantau data langsung dari perjalanan game.', {fields});
const timer = (name, minutes) => row(name, 'timer', `Timer ${minutes} menit, bisa diatur, dijeda, dan dilanjutkan.`, {minutes});
const ledger = (name, unit) => row(name, 'ledger', 'Catat angka, jumlahkan, dan simpan riwayatmu.', {unit});
const GROUPS = [
  ['perjalanan','Perjalanan','MapPinned','#1976d2',[
    guide('Jelajah Jakarta','Jakarta'),guide('Bandung Go','Bandung'),guide('Semarang Trip','Semarang'),guide('Solo Explorer','Solo'),
    guide('Jogja Jalan','Yogyakarta'),guide('Surabaya Go','Surabaya'),guide('Malang Trip','Malang'),guide('Banyuwangi Go','Banyuwangi'),
    guide('Merak Navigator','Merak'),guide('Bekasi Jalan','Bekasi'),guide('Bogor Explorer','Bogor'),guide('Cirebon Trip','Cirebon'),
    guide('Tegal Navigator','Tegal'),guide('Madiun Go','Madiun'),guide('Sragen Trip','Sragen'),guide('Pasuruan Go','Pasuruan')]],
  ['kendaraan','Kendaraan','CarFront','#d85b20',[
    metric('Drive Pulse',['kmh','place','time']),metric('Fuel Watch',['fuel','left','dest']),metric('Car Health',['dmg','veh','plate']),metric('Toll Pocket',['etoll','cash','place']),
    metric('Trip ETA',['arrive','left','dest']),metric('Shift Monitor',['job','jobGoal','jobEarned']),metric('Taxi Panel',['ride','dest','left']),metric('Weather Drive',['weather','temp','place']),
    checklist('Sebelum Jalan','Sabuk pengaman|Atur spion|Cek BBM|Cek e-Toll'),checklist('Parkir Aman','Menepi|Berhenti penuh|Matikan lampu darurat setelah aman|Catat lokasi'),
    checklist('Servis Log','Periksa ban|Periksa rem|Periksa oli|Periksa lampu'),note('Garasi Notes','Simpan catatan kendaraan dan modifikasi.'),
    calc('BBM Planner','fuel',['Jarak (km)','Konsumsi (km/l)','Harga/liter'],'Hitung kebutuhan liter dan biaya BBM perkiraan.'),
    calc('Waktu Tempuh','eta',['Jarak (km)','Kecepatan rata-rata (km/jam)'],'Hitung durasi perjalanan.'),
    calc('Bagi Ongkos','split',['Total ongkos','Jumlah orang'],'Bagi biaya perjalanan per orang.'),
    calc('Biaya per KM','ratio',['Biaya perjalanan','Jarak (km)'],'Hitung biaya perjalanan per kilometer.')]],
  ['produktivitas','Produktivitas','NotebookPen','#7c4dff',[
    note('Catatan','Tulis ide dan catatanmu.'),checklist('Tugas','Tugas pertama|Tugas kedua'),note('Jurnal Jalan','Ceritakan perjalanan hari ini.'),note('Ide Cepat','Tangkap ide sebelum terlupa.'),
    checklist('Daftar Belanja','Air minum|Camilan'),checklist('Rencana Hari','Prioritas utama|Belajar|Waktu istirahat'),checklist('Tas Perjalanan','Dompet|Pengisi daya|Botol minum'),
    checklist('Agenda Kelas','Tugas|Buku pelajaran|Proyek kelompok'),timer('Fokus 25',25),timer('Sprint 15',15),timer('Istirahat 5',5),timer('Baca 20',20),
    note('Draft Pesan','Siapkan draf pesan untuk disalin.'),note('Meeting Notes','Catat topik, keputusan, dan tindak lanjut.'),checklist('Target Mingguan','Target belajar|Target proyek|Target pribadi'),
    row('Prioritas Acak','picker','Tambahkan pilihan lalu undi satu prioritas.',{items:['Belajar','Rapikan catatan','Lanjutkan proyek']})]],
  ['utilitas','Utilitas','Calculator','#455a64',[
    row('Kalkulator','arithmetic','Hitung penjumlahan, pengurangan, perkalian dan pembagian.'),
    row('Panjang','converter','Konversi meter, kilometer, sentimeter, dan mil.',{family:'length'}),
    row('Kecepatan','converter','Konversi km/jam, m/s, dan mph.',{family:'speed'}),
    row('Berat','converter','Konversi gram, kilogram, dan ton.',{family:'mass'}),
    row('Volume','converter','Konversi liter, mililiter, dan meter kubik.',{family:'volume'}),
    row('Suhu','converter','Konversi Celsius, Fahrenheit, dan Kelvin.',{family:'temperature'}),
    row('Durasi','converter','Konversi detik, menit, jam, dan hari.',{family:'time'}),
    row('Data Unit','converter','Konversi byte, KB, MB, dan GB (basis 1024).',{family:'data'}),
    row('Stopwatch','stopwatch','Mulai, jeda, putaran, dan reset stopwatch.'),timer('Countdown',1),
    calc('Persen Cepat','percent',['Persentase','Nilai dasar'],'Hitung persentase dari suatu angka.'),calc('Diskon','discount',['Harga awal','Diskon (%)'],'Hitung harga setelah diskon.'),
    calc('Luas Persegi','area',['Panjang','Lebar'],'Hitung luas persegi panjang.'),calc('Keliling Kotak','perimeter',['Panjang','Lebar'],'Hitung keliling persegi panjang.'),
    row('Text Counter','text','Hitung karakter dan kata serta ubah huruf.',{mode:'count'}),row('Case Switch','text','Ubah teks menjadi huruf besar, kecil, atau judul.',{mode:'case'})]],
  ['belajar','Belajar','GraduationCap','#00897b',[
    quiz('Tambah Pintar','add'),quiz('Kurang Pintar','subtract'),quiz('Kali Pintar','multiply'),quiz('Bagi Pintar','divide'),quiz('Pecahan Go','fraction'),quiz('Persen Go','percent'),
    quiz('Kuadrat','square'),quiz('Pangkat Mini','power'),quiz('Geometri','geometry'),quiz('Satuan Pintar','units'),quiz('Biner Lab','binary'),quiz('Bilangan Prima','prime'),
    row('English Cards','flashcards','Kartu kosakata benda dan perjalanan.',{deck:'english'}),row('Angka Mandarin','flashcards','Kartu angka Mandarin dengan pinyin.',{deck:'mandarin'}),
    row('Kode Jalan','flashcards','Pelajari singkatan pada peta game.',{deck:'roads'}),row('Sains Cards','flashcards','Kartu konsep sains dasar.',{deck:'science'})]],
  ['game','Game','Gamepad2','#e53965',[
    row('Tebak Angka','guess','Cari angka rahasia antara 1 dan 100.',{max:100}),row('Tebak 50','guess','Cari angka rahasia antara 1 dan 50.',{max:50}),
    row('Tebak 500','guess','Tantangan angka rahasia sampai 500.',{max:500}),row('Tebak 1000','guess','Tantangan angka rahasia sampai 1000.',{max:1000}),
    row('Memory Warna','memory','Temukan pasangan warna.',{theme:'colors'}),row('Memory Bentuk','memory','Temukan pasangan bentuk.',{theme:'shapes'}),
    row('Memory Angka','memory','Temukan pasangan angka.',{theme:'numbers'}),row('Memory Huruf','memory','Temukan pasangan huruf.',{theme:'letters'}),
    row('Dadu 6','dice','Lempar satu dadu enam sisi.',{sides:6,count:1}),row('Dadu Kembar','dice','Lempar dua dadu dan jumlahkan.',{sides:6,count:2}),
    row('Dadu 20','dice','Lempar dadu dua puluh sisi.',{sides:20,count:1}),row('Koin Flip','dice','Lempar koin: angka atau gambar.',{sides:2,count:1}),
    row('Refleks','reaction','Tunggu lampu hijau lalu tekan secepatnya.',{delay:2000}),row('Refleks Cepat','reaction','Uji reaksi dengan jeda singkat.',{delay:1000}),
    row('Tap Sprint','tap','Kumpulkan tap sebanyak mungkin dalam 10 detik.',{seconds:10}),row('Tap Marathon','tap','Kumpulkan tap dalam 30 detik.',{seconds:30})]],
  ['keuangan','Keuangan','Wallet','#2e7d32',[
    ledger('Kas Harian','Rp'),ledger('Buku BBM','Rp'),ledger('Jajan Log','Rp'),ledger('Ongkos Tol','Rp'),ledger('Parkir Log','Rp'),ledger('Tabungan Game','Rp'),ledger('Pendapatan Log','Rp'),ledger('Biaya Servis','Rp'),
    calc('Patungan','split',['Total biaya','Jumlah orang'],'Hitung bagian biaya per orang.'),calc('Harga Satuan','ratio',['Harga paket','Jumlah barang'],'Bandingkan harga per satuan.'),
    calc('Target Tabungan','goal',['Target','Tabungan per hari'],'Hitung jumlah hari untuk mencapai target.'),calc('Sisa Anggaran','remaining',['Anggaran','Pengeluaran'],'Hitung selisih anggaran dan pengeluaran.'),
    calc('Pajak Simulasi','tax',['Harga','Tambahan (%)'],'Latihan hitung harga dengan tambahan persentase.'),calc('Diskon Beruntun','discount2',['Harga','Diskon pertama (%)','Diskon kedua (%)'],'Hitung dua diskon berturut-turut.'),
    checklist('Rencana Belanja','Kebutuhan utama|Bandingkan harga|Cek total'),note('Catatan Anggaran','Rencanakan pengeluaran perjalanan dalam game.')]],
  ['rutinitas','Rutinitas','CalendarCheck','#ef8d17',[
    timer('Rehat Singkat',3),timer('Rehat Panjang',10),timer('Waktu Menulis',15),timer('Belajar Mandiri',30),timer('Rapikan Meja',5),timer('Persiapan',10),
    checklist('Pagi Teratur','Rapikan tempat tidur|Siapkan tas|Cek jadwal'),checklist('Malam Teratur','Rapikan barang|Siapkan besok|Catat pencapaian'),
    checklist('Proyek Kecil','Tentukan tujuan|Kerjakan langkah awal|Cek hasil'),checklist('Beres Kamar','Rapikan meja|Susun buku|Simpan barang'),
    checklist('Trip Akhir Pekan','Pilih tujuan|Siapkan barang|Cek kendaraan'),checklist('Buku Bacaan','Pilih buku|Baca satu bab|Tulis ringkasan'),
    ledger('Halaman Dibaca','halaman'),ledger('Sesi Belajar','sesi'),note('Syukur Hari Ini','Tulis tiga hal baik hari ini.'),note('Refleksi','Apa yang berhasil dan apa yang ingin diperbaiki?')]],
  ['kreatif','Kreatif','Palette','#ab47bc',[
    row('Sketch Pad','drawing','Gambar bebas dengan pilihan warna dan ketebalan.',{paper:'#ffffff'}),row('Night Sketch','drawing','Gambar di atas kertas gelap.',{paper:'#172033'}),
    row('Mint Sketch','drawing','Gambar di atas kertas mint.',{paper:'#e0f2e9'}),row('Sunset Sketch','drawing','Gambar di atas kertas hangat.',{paper:'#fff1df'}),
    row('Palet Laut','palette','Buat dan salin kombinasi warna bernuansa biru.',{hue:210}),row('Palet Hutan','palette','Buat kombinasi hijau.',{hue:145}),
    row('Palet Senja','palette','Buat kombinasi jingga dan merah.',{hue:20}),row('Palet Ungu','palette','Buat kombinasi violet.',{hue:275}),
    note('Cerita Mini','Tulis cerita singkat dari perjalananmu.'),note('Puisi Jalan','Tulis puisi dan simpan di HP.'),note('Lirik Draft','Simpan lirik ciptaanmu.'),note('Ide Poster','Catat judul, pesan, dan komposisi poster.'),
    row('Prompt Cerita','picker','Undi titik awal untuk cerita baru.',{items:['Gerbang tol yang tak ada di peta','Surat di rest area','Perjalanan terakhir sebelum senja','Kota di balik kabut']}),
    row('Warna Pilihan','picker','Undi tema warna proyekmu.',{items:['Biru laut','Hijau hutan','Jingga senja','Ungu malam','Merah bata']}),
    row('Balik Teks','text','Balik urutan karakter teks.',{mode:'reverse'}),row('Slug Maker','text','Ubah judul menjadi slug yang rapi.',{mode:'slug'})]],
  ['eksplorasi','Eksplorasi','Compass','#00838f',[
    guide('Gerbang Finder','GT'),guide('Junction Finder','JCT'),guide('Tangerang Go','Tangerang'),guide('Cikarang Go','Cikarang'),guide('Karawang Go','Karawang'),guide('Purwakarta Go','Purwakarta'),
    guide('Batang Trip','Batang'),guide('Kendal Go','Kendal'),guide('Salatiga Trip','Salatiga'),guide('Boyolali Trip','Boyolali'),guide('Ngawi Trip','Ngawi'),guide('Jombang Trip','Jombang'),
    checklist('Kota Dikunjungi','Jakarta|Bandung|Semarang|Surabaya'),note('Travel Journal','Simpan cerita tentang kota dalam perjalananmu.'),
    row('Tujuan Acak','random-place','Undi kota dari jaringan game dan mulai navigasi.'),row('Trip Snapshot','snapshot','Simpan ringkasan perjalanan saat ini ke catatan lokal.')]]
];
export const APP_CATEGORIES = GROUPS.map(([id,name,icon,color]) => ({id,name,icon,color}));
export const APP_CATALOG = GROUPS.flatMap(([category, categoryName, icon, color, apps]) => apps.map((a,i) => Object.freeze({...a,id:`store-${category}-${i+1}`,k:`store-${category}-${i+1}`,category,categoryName,icon,color,version:'1.0'})));
export const APP_BY_ID = new Map(APP_CATALOG.map(a=>[a.id,a]));
export const STARTER_APPS = ['store-produktivitas-1','store-produktivitas-2','store-utilitas-1','store-utilitas-9','store-game-1','store-kreatif-1'];
export function createAppLibrary(raw = {}, onSave = () => {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const installed = new Set((Array.isArray(raw.installed) ? raw.installed : STARTER_APPS).filter(id=>APP_BY_ID.has(id)));
  const data = Object.create(null);
  if (raw.data && typeof raw.data === 'object') for (const id of installed) {
    const d = raw.data[id]; if (d && typeof d === 'object' && JSON.stringify(d).length <= 16000) data[id] = d;
  }
  const snapshot = () => ({installed:[...installed],data:{...data}});
  const save = () => onSave(snapshot());
  return {snapshot, has:id=>installed.has(id), list:()=>[...installed].map(id=>APP_BY_ID.get(id)),
    install(id){if(!APP_BY_ID.has(id))return false;installed.add(id);save();return true;},
    uninstall(id){if(!installed.delete(id))return false;delete data[id];save();return true;},
    read:id=>data[id] || {},
    write(id,value){if(!installed.has(id)||!value||typeof value!=='object'||JSON.stringify(value).length>16000)return false;data[id]=value;save();return true;},
    search(query='',category='',onlyInstalled=false){const q=query.trim().toLocaleLowerCase('id-ID');return APP_CATALOG.filter(a=>(!category||a.category===category)&&(!onlyInstalled||installed.has(a.id))&&(!q||`${a.name} ${a.description} ${a.categoryName}`.toLocaleLowerCase('id-ID').includes(q)));}
  };
}
export const UNITS = {
  length:[['m',1],['km',1000],['cm',0.01],['mil',1609.344]],speed:[['km/jam',1],['m/s',3.6],['mph',1.609344]],
  mass:[['g',1],['kg',1000],['ton',1000000]],volume:[['liter',1],['ml',0.001],['m³',1000]],
  temperature:[['°C',1],['°F',1],['K',1]],time:[['detik',1],['menit',60],['jam',3600],['hari',86400]],data:[['byte',1],['KB',1024],['MB',1048576],['GB',1073741824]]
};
export function convert(value, family, from, to){
  const units=UNITS[family];if(!Number.isFinite(value)||!units?.[from]||!units?.[to])throw Error('Masukkan angka yang valid.');
  if(family==='temperature'){const c=from===0?value:from===1?(value-32)*5/9:value-273.15;return to===0?c:to===1?c*9/5+32:c+273.15;}
  return value*units[from][1]/units[to][1];
}
export function calculate(mode, values){
  if(values.some(v=>!Number.isFinite(v)))throw Error('Lengkapi semua angka.');
  const [a,b,c]=values;let result;
  if(['split','ratio','goal','eta'].includes(mode)&&b<=0)throw Error('Pembagi harus lebih dari nol.');
  if(mode==='fuel'&&(b<=0||a<0||c<0))throw Error('Jarak dan harga tidak boleh negatif; konsumsi harus lebih dari nol.');
  if(mode==='discount'&&(b<0||b>100)||mode==='discount2'&&([b,c].some(v=>v<0||v>100)))throw Error('Diskon harus 0–100%.');
  switch(mode){case 'fuel':result=`${formatNumber(a/b)} liter · biaya ${formatNumber(a/b*c)}`;break;
    case 'eta':result=`${formatNumber(a/b*60)} menit`;break;case 'percent':result=a*b/100;break;
    case 'discount':result=a*(1-b/100);break;case 'discount2':result=a*(1-b/100)*(1-c/100);break;
    case 'tax':result=a*(1+b/100);break;case 'remaining':result=a-b;break;case 'area':result=a*b;break;
    case 'perimeter':result=2*(a+b);break;default:result=a/b;}
  if(typeof result==='number'&&!Number.isFinite(result))throw Error('Hasil di luar jangkauan.');return result;
}
export const formatNumber = n => Number(n).toLocaleString('id-ID',{maximumFractionDigits:4});
export const DECKS = {
  english:[['Jalan','Road'],['Jembatan','Bridge'],['Kendaraan','Vehicle'],['Perjalanan','Journey'],['Tujuan','Destination'],['Persimpangan','Junction'],['Kiri','Left'],['Kanan','Right']],
  mandarin:[['1','一 · yī'],['2','二 · èr'],['3','三 · sān'],['4','四 · sì'],['5','五 · wǔ'],['6','六 · liù'],['7','七 · qī'],['8','八 · bā'],['9','九 · jiǔ'],['10','十 · shí']],
  roads:[['GT','Gerbang Tol'],['JCT','Junction / simpang susun'],['KM','Kilometer'],['Rest area','Tempat istirahat'],['Contraflow','Penggunaan sebagian jalur arah berlawanan'],['ETA','Perkiraan waktu tiba']],
  science:[['Sel','Unit dasar makhluk hidup'],['Nukleus','Mengandung materi genetik sel'],['Kloroplas','Tempat fotosintesis'],['Gravitasi','Gaya tarik antar benda bermassa'],['Gesekan','Gaya yang menghambat gerak relatif'],['Evaporasi','Perubahan cairan menjadi gas']]
};
export function makeQuestion(topic, random = Math.random){
  const a=2+Math.floor(random()*18),b=2+Math.floor(random()*8);let text,answer,explanation;
  switch(topic){case 'add':text=`${a} + ${b}`;answer=a+b;break;case 'subtract':text=`${a+b} − ${b}`;answer=a;break;
    case 'multiply':text=`${a} × ${b}`;answer=a*b;break;case 'divide':text=`${a*b} ÷ ${b}`;answer=a;break;
    case 'fraction':text=`1/${b} dari ${a*b}`;answer=a;break;case 'percent':text=`${b*10}% dari ${a*10}`;answer=a*b;break;
    case 'square':text=`${a}²`;answer=a*a;break;case 'power':text=`2 pangkat ${b}`;answer=2**b;break;
    case 'geometry':text=`Luas persegi panjang ${a} × ${b}`;answer=a*b;break;case 'units':text=`${a} km = berapa meter?`;answer=a*1000;break;
    case 'binary':text=`Biner ${a.toString(2)} = desimal?`;answer=a;break;
    case 'prime':text=`Bilangan prima setelah ${[2,3,5,7,11,13,17,19][b-2]}?`;answer=[3,5,7,11,13,17,19,23][b-2];break;
    default:throw Error('Topik tidak dikenal');}
  explanation=`${text} = ${answer}`;return {text,answer,explanation};
}
