// A local simulation policy inspired by UU 22/2009. Amounts are game penalties,
// not statutory maximum fines. Both player and AI are evaluated by the same code.
export const LAW_SOURCE='https://jdih.kemenkeu.go.id/api/download/fulltext/2009/22TAHUN2009UU.htm';
export const TRAFFIC_LAWS=Object.freeze([
  {id:'speed',title:'Patuhi batas kecepatan',article:'Pasal 106(4), 115–116',detail:'Ikuti rambu ruas, kota, ramp dan pekerjaan jalan. Perlambat saat hujan atau mendekati simpang.',fine:50000,points:5},
  {id:'red',title:'Berhenti sebelum garis saat merah',article:'Pasal 106(4), 112(3)',detail:'Belok kiri juga mengikuti lampu. Kuning: berhenti jika masih aman. Kendaraan yang sudah melintas boleh menyelesaikan gerakannya.',fine:100000,points:10},
  {id:'wrongway',title:'Gunakan jalur kiri sesuai arah',article:'Pasal 108',detail:'Dilarang melawan arus. Contraflow resmi yang dibuka pada simulasi mengikuti arah petugas.',fine:100000,points:10},
  {id:'left',title:'Kendaraan lambat di lajur kiri',article:'Pasal 108(3)–(4)',detail:'Sepeda, motor dan mobil barang kembali ke kiri jika tersedia. Mendahului, menghindari penutupan dan persiapan belok diperhitungkan.',fine:25000,points:3},
  {id:'signal',title:'Beri isyarat sebelum bergeser',article:'Pasal 112(1)–(2)',detail:'Nyalakan sein kiri/kanan sebelum pindah lajur. Pada sepeda, tombol ini mewakili isyarat tangan. Hazard bukan sein.',fine:25000,points:3},
  {id:'gap',title:'Jaga jarak dan pindah saat aman',article:'Pasal 105, 109, 112(2)',detail:'AI menjaga sela waktu sekitar 2 detik, lebih jauh saat hujan. Jangan membuntuti rapat atau memotong kendaraan lain.',fine:25000,points:3},
  {id:'shoulder',title:'Bahu jalan untuk keadaan darurat',article:'Pasal 106(4), 108',detail:'Jangan memakai bahu untuk melaju. Berhenti untuk kerusakan, masuk/keluar ramp dan menepi memberi jalan diperhitungkan.',fine:50000,points:5},
  {id:'closed',title:'Patuhi lajur ditutup dan marka',article:'Pasal 106(4)',detail:'Jangan masuk ke lajur yang ditutup cone. Beri ruang kendaraan yang bergabung ke lajur terbuka.',fine:50000,points:5},
  {id:'priority',title:'Beri jalan kendaraan darurat',article:'Pasal 134–135',detail:'Menepi dan perlambat untuk kendaraan bertugas dengan sirene. Hak utama tidak menghilangkan kewajiban mencegah tabrakan.',fine:50000,points:5},
  {id:'junction',title:'Jangan mengunci persimpangan',article:'Pasal 105, 106',detail:'Meskipun hijau, tunggu sebelum garis jika ruang setelah simpang tidak cukup. Kendaraan dari ramp menunggu celah di jalan utama.',fine:25000,points:3},
  {id:'toll',title:'Patuhi akses kendaraan dan gerbang',article:'Rambu ruas dalam simulasi',detail:'Sepeda dan motor memakai non-tol. Patuhi pembatasan MBZ dan berhenti untuk pembayaran e-Toll.',fine:100000,points:10}
]);
export const LAW_BY_ID=Object.fromEntries(TRAFFIC_LAWS.map(r=>[r.id,r]));
export function mustStop(signal,distance,speed,priority=false){return !priority&&(signal==='R'||signal==='Y'&&distance>Math.max(6,speed*speed/6));}
export function safeStep(step,{stop=Infinity,queue=Infinity,block=Infinity}={}){return Math.max(0,Math.min(step,stop,queue,block));}
export function followSeconds(wet=false,heavy=false){return (heavy?2.4:2)+(wet?0.8:0);}
export function laneChangeSafe(frontGap,rearGap,speed,rearSpeed=0){return frontGap>Math.max(5,speed*0.5)&&rearGap>6+Math.max(0,rearSpeed-speed)*2;}
export function inferLaw(msg){
  if(/batas/.test(msg))return 'speed';if(/lampu merah/.test(msg))return 'red';if(/melawan arus|putaran balik/.test(msg))return 'wrongway';
  if(/lajur kiri/.test(msg))return 'left';if(/bahu|badan jalan/.test(msg))return 'shoulder';if(/ditutup|pekerjaan/.test(msg))return 'closed';if(/gerbang|tol/.test(msg))return 'toll';return null;
}
export function createLawAuditor(){
  let states=new WeakMap();
  return {reset(){states=new WeakMap();},sample(v,f,dt){
    let s=states.get(v);if(!s){s={timers:{},last:{},front:f.front,lane:f.lane,route:f.route,sd:f.sd};states.set(v,s);}
    const events=[],age=(id,on,seconds)=>{s.timers[id]=on?(s.timers[id]||0)+dt:0;if(s.timers[id]>=seconds){emit(id);s.timers[id]=0;}};
    const emit=id=>{if(f.time-(s.last[id]??-Infinity)<20)return;s.last[id]=f.time;events.push(id);};
    // Teleports, route rebuilds and direction changes must never become line crossings.
    const continuous=s.route===f.route&&s.sd===f.sd&&Math.abs(f.front-s.front)<Math.max(12,Math.abs(f.speed)*dt*3);
    if(!continuous)s.timers={};
    age('speed',Math.abs(f.speed)>f.limit+1.4&&!f.priority,2.5);
    age('wrongway',f.wrongway&&!f.priority&&Math.abs(f.speed)>1,1);
    age('shoulder',f.shoulder&&!f.exemptShoulder&&!f.priority&&Math.abs(f.speed)>2,2);
    age('left',f.leftRequired&&!f.leftException&&Math.abs(f.speed)>4,6);
    age('closed',f.closed&&!f.priority&&Math.abs(f.speed)>1,0.3);
    age('gap',f.gap>=0&&f.gap<Math.max(2,Math.abs(f.speed)*0.65)&&Math.abs(f.speed)>7&&!f.braking,2);
    age('priority',f.emergencyBehind&&!f.givingWay&&!f.priority&&Math.abs(f.speed)>3,4);
    age('junction',f.inJunction&&Math.abs(f.speed)<0.5&&!f.priority,5);
    if(continuous){
      for(const light of f.lights||[])if(s.front<light.line&&f.front>=light.line&&light.signal==='R'&&!f.priority)emit('red');
      if(f.lane!==s.lane&&f.lane>=0&&s.lane>=0&&Math.abs(f.speed)>1){const direction=Math.sign(f.lane-s.lane);if(f.indicator!==direction)emit('signal');if(f.unsafeMerge)emit('gap');}
    }
    s.front=f.front;s.lane=f.lane;s.route=f.route;s.sd=f.sd;return events;
  }};
}
