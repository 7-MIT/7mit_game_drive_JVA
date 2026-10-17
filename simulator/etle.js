import {LAW_BY_ID} from './traffic-law.js';
// Camera positions are generated on every driven corridor, not a city whitelist.
export function makeEtleCameras(events,towns,corridorAt,spacing=1600){
  if(!events.length)return [];
  const out=[],add=(u,kind,name)=>{for(const sd of [1,-1])out.push({id:`${kind}:${Math.round(u)}:${sd}`,u,sd,kind,name,corridor:corridorAt(u),range:125});};
  const begin=events[0].u-2000,end=events.at(-1).u+6000;
  for(let u=begin+200;u<end;u+=spacing)if(!towns.some(s=>Math.abs(s.u-u)<180))add(u,'speed','Kamera ruas');
  // Short segments between interchanges also receive a camera.
  for(let i=0;i<events.length-1;i++){const a=events[i].u,b=events[i+1].u;if(!out.some(c=>c.u>=a&&c.u<b))add((a+b)/2,'speed','Kamera ruas');}
  for(const s of towns)add(s.u,'junction',s.name);
  return out.sort((a,b)=>a.u-b.u||b.sd-a.sd);
}
export function cameraSees(c,f){return c.sd===f.sd&&!f.ramp&&Math.abs(f.u-c.u)<c.range&&f.lane>=-f.lanes-0.8&&f.lane<f.lanes+0.8;}
export function createEtle({load=()=>[],save=()=>{}}={}){
  let records;try{records=load();}catch{records=[];}if(!Array.isArray(records))records=[];
  records=records.filter(r=>r&&LAW_BY_ID[r.code]&&typeof r.id==='string').slice(0,100);
  let cameras=[],tracks=new Map(),last=new Map(),seq=records.length,captureCount=0,scanCount=0;
  const persist=()=>{try{save(records.slice(0,100).map((r,i)=>i<12?r:{...r,image:null}));}catch{try{save(records.map(r=>({...r,image:null})));}catch{}}};
  return {get cameras(){return cameras;},get records(){return records;},get tracks(){return [...tracks.values()];},get scans(){return scanCount;},get captures(){return captureCount;},
    setCameras(v){cameras=v;tracks.clear();last.clear();},
    scan(facts,time){scanCount++;const next=new Map();for(const f of facts){const c=cameras.filter(c=>cameraSees(c,f)).sort((a,b)=>Math.abs(a.u-f.u)-Math.abs(b.u-f.u))[0];if(!c)continue;const key=c.id+'|'+f.id,prev=tracks.get(key),samples=prev?prev.samples+1:1;next.set(key,{...f,camera:c.id,samples,seen:time});}tracks=next;},
    capture(code,f,time){
      if(!LAW_BY_ID[code])return null;
      const t=[...tracks.values()].find(t=>t.id===f.id&&time-t.seen<0.6&&t.samples>=2);if(!t)return null;
      const key=f.id+'|'+code;if(time-(last.get(key)??-Infinity)<20)return null;last.set(key,time);
      const cam=cameras.find(c=>c.id===t.camera);if(!cam||!cameraSees(cam,f))return null;
      const evidence={id:`ETLE-${Date.now().toString(36)}-${++seq}`,code,vehicle:f.id,plate:f.plate,type:f.type,player:!!f.player,camera:cam.id,road:f.road,time,created:new Date().toISOString(),speed:+(Math.abs(f.speed)*3.6).toFixed(1),limit:Math.round(f.limit*3.6),lane:f.lane,signal:f.signal||null,indicator:f.indicator||0,samples:t.samples,priority:!!f.priority,status:'pending',image:null};
      records.unshift(evidence);records=records.slice(0,100);captureCount++;persist();return evidence;
    },
    attachImage(id,image){const r=records.find(r=>r.id===id);if(r&&typeof image==='string'&&image.startsWith('data:image/')){r.image=image;persist();}},
    review(id,decision){const r=records.find(r=>r.id===id);if(!r||r.status!=='pending'||!['confirmed','rejected'].includes(decision))return null;r.status=decision;r.reviewed=new Date().toISOString();persist();return r;},
    summary(){return {pending:records.filter(r=>r.status==='pending').length,confirmed:records.filter(r=>r.status==='confirmed').length,rejected:records.filter(r=>r.status==='rejected').length,player:records.filter(r=>r.player).length,ai:records.filter(r=>!r.player).length};}
  };
}
