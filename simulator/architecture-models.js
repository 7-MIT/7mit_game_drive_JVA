import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
let materials=null;
function canvasTexture(draw,size=256){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t.userData.keep=true;return t;}
function getMaterials(){if(materials)return materials;
  const wall=canvasTexture((x,s)=>{x.fillStyle='#edeae4';x.fillRect(0,0,s,s);let a=91;for(let i=0;i<6000;i++){a=(Math.imul(a,1664525)+1013904223)>>>0;const v=180+a%60;x.fillStyle=`rgba(${v},${v},${v},.15)`;x.fillRect(a%s,(a>>>8)%s,1,1);}x.fillStyle='#b3b6b6';x.fillRect(39,52,178,161);x.fillStyle='#283b46';x.fillRect(45,58,166,149);x.fillStyle='#58727f';x.fillRect(50,64,75,137);x.fillStyle='#79929b';x.fillRect(55,68,66,6);x.fillStyle='#c4c4bc';x.fillRect(125,58,5,149);x.fillRect(45,130,166,4);x.fillStyle='#a1a6a5';x.fillRect(34,213,188,8);x.fillStyle='#d5d4ce';x.fillRect(36,48,184,5);});
  const roof=canvasTexture((x,s)=>{x.fillStyle='#9c5d46';x.fillRect(0,0,s,s);for(let j=0;j<8;j++)for(let i=0;i<8;i++){const xx=i*32+(j%2?16:0),yy=j*32;x.fillStyle=(i+j)%3?'#af7056':'#8f513e';x.fillRect(xx,yy,30,28);x.fillStyle='#c68b69';x.fillRect(xx+3,yy+2,4,23);x.fillStyle='#633c30';x.fillRect(xx,yy+27,31,4);}});
  const metal=canvasTexture((x,s)=>{x.fillStyle='#c4c7c9';x.fillRect(0,0,s,s);for(let i=0;i<s;i+=16){x.fillStyle='#a6abad';x.fillRect(i,0,3,s);x.fillStyle='#e0e1df';x.fillRect(i+3,0,2,s);}});
  // ijuk / alang-alang thatch for rumah gadang, Bali and meru roofs
  const thatch=canvasTexture((x,s)=>{x.fillStyle='#3a302a';x.fillRect(0,0,s,s);let a=7;for(let i=0;i<2600;i++){a=(Math.imul(a,1664525)+1013904223)>>>0;const v=40+a%45;x.strokeStyle=`rgb(${v+12},${v+4},${v-6})`;x.lineWidth=1+(a>>>20)%2;const px=a%s,py=(a>>>9)%s;x.beginPath();x.moveTo(px,py);x.lineTo(px+((a>>>5)%5)-2,py+10+(a>>>13)%14);x.stroke();}});
  const mat=(o)=>{const m=new THREE.MeshStandardMaterial(o);m.userData.terrain=true;return m;};
  materials={wall:mat({color:0xffffff,map:wall,vertexColors:true,roughness:.89}),roof:mat({color:0xffffff,map:roof,roughness:.84,vertexColors:true}),metal:mat({color:0xffffff,map:metal,metalness:.30,roughness:.60,vertexColors:true}),trim:mat({color:0xffffff,vertexColors:true,roughness:.72}),glass:mat({color:0x39515d,roughness:.18,metalness:.45}),wood:mat({color:0x574231,roughness:.86}),
    roofD:mat({color:0xffffff,map:roof,roughness:.84,vertexColors:true,side:THREE.DoubleSide}),thatch:mat({color:0xffffff,map:thatch,roughness:.95,vertexColors:true,side:THREE.DoubleSide}),cloth:mat({color:0xffffff,vertexColors:true,roughness:.8,side:THREE.DoubleSide})};return materials;
}
export function architectureMaterials(){return Object.values(getMaterials());}
export function buildArchitecture(parent,buildings){
  const M=getMaterials(),batches=new Map(),tmp=new THREE.Color();
  const add=(geo,mat,color=0xffffff)=>{if(mat.vertexColors){const c=tmp.set(color),ca=new Float32Array(geo.attributes.position.count*3);for(let i=0;i<ca.length;i+=3){ca[i]=c.r;ca[i+1]=c.g;ca[i+2]=c.b;}geo.setAttribute('color',new THREE.BufferAttribute(ca,3));}if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(geo);};
  const box=(mat,color,w,h,d,x,y,z)=>{const g=new THREE.BoxGeometry(w,h,d);const uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++){const face=Math.floor(i/4),horizontal=face<2?d:face<4?w:w,vertical=face<2?h:face<4?d:h;uv.setXY(i,uv.getX(i)*horizontal/2.5,uv.getY(i)*vertical/3.1);}g.translate(x,y,z);add(g,mat,color);};
  const face=(points,mat,color)=>{const p=[],uv=[],idx=[];points.forEach(([x,y,z],i)=>{p.push(x,y,z);uv.push(i===1||i===2?Math.max(1,points[0][0]===points[1][0]?Math.abs(points[0][2]-points[1][2]):Math.abs(points[0][0]-points[1][0])):0,i>1?2:0);});for(let i=1;i<points.length-1;i++)idx.push(0,i,i+1);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();add(g,mat,color);};
  const quad=(a,b,c,d,mat,color)=>face([a,b,c,d],mat,color);
  // a hip roof (or a pyramid when the top is a point): base rectangle ±hx/±hz at y0, top ±tx/±tz at y1
  const hip=(x,z,hx,hz,y0,tx,tz,y1,mat,color)=>{const P=(sx,sz,top)=>[x+sx*(top?tx:hx),top?y1:y0,z+sz*(top?tz:hz)];
    quad(P(-1,-1),P(1,-1),P(1,-1,1),P(-1,-1,1),mat,color);quad(P(1,1),P(-1,1),P(-1,1,1),P(1,1,1),mat,color);quad(P(-1,1),P(-1,-1),P(-1,-1,1),P(-1,1,1),mat,color);quad(P(1,-1),P(1,1),P(1,1,1),P(1,-1,1),mat,color);
    if(tx>0&&tz>0)quad(P(-1,-1,1),P(1,-1,1),P(1,1,1),P(-1,1,1),mat,color);};
  // a gable roof with the ridge along z; lift(t) bends ridge and eaves up toward the ends (t = -1 … 1), for the gonjong of a rumah gadang
  const gable=(x,z,hx,hz,y0,rise,mat,color,lift=null,n=1)=>{for(let i=0;i<n;i++){const t0=-1+2*i/n,t1=-1+2*(i+1)/n,z0=z+t0*hz,z1=z+t1*hz,l0=lift?lift(t0):0,l1=lift?lift(t1):0;
      for(const sx of [-1,1])quad([x+sx*hx,y0+l0*.45,z0],[x+sx*hx,y0+l1*.45,z1],[x,y0+rise+l1,z1],[x,y0+rise+l0,z0],mat,color);}
    if(!lift)for(const sz of [-1,1])face([[x-hx,y0,z+sz*hz],[x+hx,y0,z+sz*hz],[x,y0+rise,z+sz*hz]],mat,color);};
  const posts=(x,z,hx,hz,y0,y1,nx,nz,color=0x5a3b26)=>{for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const px=x-hx+2*hx*(nx>1?i/(nx-1):.5),pz=z-hz+2*hz*(nz>1?j/(nz-1):.5);box(M.wood,color,.22,y1-y0,.22,px,(y0+y1)/2,pz);}};
  // regional houses and structures (see roadside() in main.js for where each one stands)
  const REGIONAL={
    // Javanese joglo: low walls under a broad eave, the tall pyramid (brunjung) in the middle; pendopo = open hall on posts
    joglo(b){const {x,z,d,w}=b,h=3;if(b.open){box(M.trim,0xb8ae9c,d+1,.5,w+1,x,.25,z);posts(x,z,d/2-.3,w/2-.3,.5,h,3,4);}else box(M.wall,b.color??0xece4d2,d,h,w,x,h/2,z);
      const r=b.roofColor??0x8a4b35;hip(x,z,d/2+1.3,w/2+1.3,h,d*.2,w*.28,h+1.7,M.roofD,r);hip(x,z,d*.2,w*.28,h+1.7,.05,w*.14,h+4.6,M.roofD,r);box(M.trim,0x6b4a33,.2,.18,w*.3,x,h+4.62,z);},
    // Betawi rumah kebaya: plastered walls, front verandah (langkan) with green railing, gable roof over both, gigi balang trim
    betawi(b){const {x,z,d,w}=b,h=3.2,f=-Math.sign(x)||1,vx=x+f*(d/2+1.2),trim=b.trim??0x2f7d4f;box(M.wall,b.color??0xf1e7c6,d,h,w,x,h/2,z);box(M.trim,0xc9c1ae,d+2.8,.45,w+.4,x+f*1.2,.22,z);
      posts(vx,z,0,w/2-.2,.45,h,1,4,0xe8e2d0);for(let k=0;k<Math.floor(w/.5);k++)box(M.trim,trim,.06,.7,.06,vx,.8,z-w/2+.3+k*.5);box(M.trim,trim,.1,.08,w-.3,vx,1.15,z);
      gable(x+f*.6,z,d/2+2.1,w/2+.5,h,2.6,M.roofD,b.roofColor??0x8a4b35);for(let k=0;k<Math.floor(w/.42);k++)box(M.trim,k%2?trim:0xf5f2e8,.05,.22,.2,vx+f*.95,h-.14,z-w/2+.4+k*.42);},
    // Minangkabau rumah gadang: house on posts, carved red-brown walls with a gold band, thatched roof with gonjong horns at both ends
    gadang(b){const {x,z,d,w}=b,st=1.7,h=3.2,y=st+h;posts(x,z,d/2-.3,w/2-.3,0,st,3,Math.max(3,Math.round(w/3)));box(M.wall,b.color??0x7a3a22,d,h,w,x,st+h/2,z);
      box(M.trim,0xc9a23a,d+.1,.35,w+.1,x,st+h-.5,z);box(M.trim,0x5a2a18,d+.2,.3,w+.2,x,st,z);
      gable(x,z,d/2+.9,w/2+1.6,y,2.4,M.thatch,0xffffff,t=>2.8*Math.pow(Math.abs(t),3.2),12);
      for(const sz of [-1,1]){box(M.trim,0x8b8478,.18,1.2,.18,x,y+2.4+2.8+.5,z+sz*(w/2+1.6));}},
    // Malay / Sumatran stilt house (rumah panggung): wooden, gable roof with crossed ridge ends
    panggung(b){const {x,z,d,w}=b,st=1.4,h=2.8,y=st+h;posts(x,z,d/2-.2,w/2-.2,0,st,3,3);box(M.wood,b.color??0x8b5a3c,d,h,w,x,st+h/2,z);
      box(M.trim,0x6e4a30,.2,st,1.2,x-(Math.sign(x)||1)*(d/2+.6),st/2,z+w*.2);gable(x,z,d/2+.7,w/2+.6,y,2.6,M.roofD,b.roofColor??0x8d9296);
      for(const sz of [-1,1])for(const sx of [-1,1])box(M.trim,0x4a3424,.12,1.1,.12,x+sx*.35,y+2.9,z+sz*(w/2+.6));},
    // Balinese house: red brick with paras stone base and corners, steep thatched hip roof
    bali(b){const {x,z,d,w}=b,h=2.9;box(M.trim,0xd8cdb0,d+.6,.6,w+.6,x,.3,z);box(M.wall,b.color??0xa65a3c,d,h,w,x,.6+h/2,z);
      for(const sx of [-1,1])for(const sz of [-1,1])box(M.trim,0xd8cdb0,.4,h+.2,.4,x+sx*d/2,.6+h/2,z+sz*w/2);
      hip(x,z,d/2+.9,w/2+.9,h+.6,d*.08,w*.18,h+.6+Math.min(d,w)*.62,M.thatch,0xffffff);},
    // candi bentar: the split gate of Bali (and the Javanese kraton), two stepped brick towers with stone trim
    gapura(b){const {x,z}=b,H=b.h||7.5,gap=b.gap||2.6;for(const sz of [-1,1]){const zc=z+sz*(gap/2+1.3);box(M.trim,0xd8cdb0,2.8,1,2.4,x,.5,zc);
        let y=1,ww=2.4,dd=2.2;for(let k=0;k<6;k++){const th=k?(H-3.4)/5:2.4;box(M.wall,0xa65a3c,dd,th,ww,x,y+th/2,zc+sz*(2.4-ww)/2*.3);box(M.trim,0xd8cdb0,dd+.12,.14,ww+.12,x,y+th,zc);y+=th+.14;ww*=.8;dd*=.8;}}
      for(const sz of [-1,1])box(M.wall,0xa65a3c,.9,1.6,5,x,.8,z+sz*(gap/2+5.1));},
    // meru: the many-roofed shrine tower of a Balinese pura (3 to 11 roofs)
    meru(b){const {x,z}=b,n=b.tiers||5,s0=b.s||4.2;box(M.trim,0xd8cdb0,s0+1,1.2,s0+1,x,.6,z);box(M.wall,0xa65a3c,s0*.55,2.2,s0*.55,x,2.3,z);let y=3.4,s1=s0;
      for(let k=0;k<n;k++){hip(x,z,s1/2,s1/2,y,s1*.22,s1*.22,y+.75,M.thatch,0xffffff);box(M.wood,0x4a3424,s1*.32,.55,s1*.32,x,y+1.0,z);y+=1.25;s1*=.86;}
      box(M.trim,0xc9a23a,.25,.9,.25,x,y+.4,z);},
    // a market stall (lapak pasar): posts, a tarp roof and a table of produce
    lapak(b){const {x,z,d,w}=b,f=-Math.sign(x)||1,h=2.3;posts(x,z,d/2,w/2,0,h+(f>0?0:.4),2,2,0x8a8478);
      quad([x-d/2,h+(f<0?.4:0),z-w/2-.15],[x+d/2,h+(f>0?.4:0),z-w/2-.15],[x+d/2,h+(f>0?.4:0),z+w/2+.15],[x-d/2,h+(f<0?.4:0),z+w/2+.15],M.cloth,b.color??0x2d6fb7);
      box(M.wood,0x8a6a4a,d*.7,.8,w*.85,x,.4,z);const P=[0xe0a020,0x4c9a2a,0xc8402a,0xe8d8a0,0x7a3a8a];for(let k=0;k<6;k++)box(M.trim,P[(k+Math.round(z))%P.length],d*.18,.18,w*.12,x-d*.22+(k%2)*d*.3,.88,z-w*.32+Math.floor(k/2)*w*.32);},
  };
  for(const b of buildings){const {x,z,d,w,h}=b,color=b.color??0xd6cfc0,near=Math.abs(x)<155,type=b.type||(h>18?'tower':d>22?'warehouse':'house');
    if(REGIONAL[type]){REGIONAL[type](b);continue;}
    box(type==='warehouse'?M.metal:M.wall,color,d,h,w,x,h/2,z);box(M.trim,0x8b8981,d+.12,.30,w+.12,x,.15,z);
    if(type==='house'){
      const rise=Math.min(3.2,Math.min(d,w)*.33),dx=d/2+.42,dz=w/2+.42,y=h+.10,ridge=h+rise;
      face([[x-dx,y,z-dz],[x-dx,y,z+dz],[x,ridge,z+w*.25],[x,ridge,z-w*.25]],M.roof,b.roofColor??0xffffff);
      face([[x+dx,y,z+dz],[x+dx,y,z-dz],[x,ridge,z-w*.25],[x,ridge,z+w*.25]],M.roof,b.roofColor??0xffffff);
      face([[x-dx,y,z+dz],[x+dx,y,z+dz],[x,ridge,z+w*.25]],M.roof,b.roofColor??0xffffff);
      face([[x+dx,y,z-dz],[x-dx,y,z-dz],[x,ridge,z-w*.25]],M.roof,b.roofColor??0xffffff);
      box(M.trim,0xccc6b9,d+.85,.15,w+.85,x,h+.02,z);box(M.trim,0x8c5c43,.15,.13,w*.5+.15,x,ridge+.02,z);
    }else{
      box(type==='warehouse'?M.metal:M.trim,type==='warehouse'?0xc8cbcc:0xaca99e,d+.38,.18,w+.38,x,h+.09,z);
      for(const side of [-1,1])box(M.trim,0xd8d4c9,.16,.50,w+.25,x+side*d/2,h+.28,z);
      if(type==='tower'){for(let y=3.1;y<h;y+=3.1)box(M.trim,0xc4c7c4,d+.10,.10,w+.10,x,y,z);box(M.trim,0x81878a,d*.25,1.8,w*.23,x,h+1.05,z);}
    }
    if(!near)continue;
    const front=x-Math.sign(x)*d/2,side=-Math.sign(x),entryZ=z+w*.18;
    box(M.wood,0xffffff,.04,2.12,.90,front+side*.025,1.06,entryZ);box(M.trim,0xc2bdb1,.11,.12,1.08,front+side*.05,2.17,entryZ);
    for(const dz of [-.51,.51])box(M.trim,0xc2bdb1,.11,2.2,.10,front+side*.05,1.1,entryZ+dz);
    box(M.trim,0xb7b7af,.50,.14,1.30,front+side*.20,.07,entryZ);box(M.trim,0xadb0ae,.03,.16,.035,front+side*.09,1.06,entryZ+.28);
    box(M.trim,0xb6b6ae,.09,h,.09,front+side*.06,h/2,z-w*.43);
    if(type==='shop'||type==='warehouse'){
      const bays=Math.max(1,Math.floor(w/3.2));for(let k=0;k<bays;k++){const zz=z-w/2+(k+.5)*w/bays;box(type==='shop'?M.glass:M.metal,0xcbd0d0,.05,2.35,w/bays-.30,front+side*.035,1.35,zz);for(const off of [-.45,.45])box(M.trim,0xadb5b7,.07,2.5,.05,front+side*.09,1.32,zz+off*(w/bays-.1));}
      box(M.trim,b.awning??0x40586b,1.15,.12,w-.14,front+side*.48,2.92,z);box(M.trim,b.awning??0x40586b,.12,.55,w-.14,front+side*1.02,2.72,z);
      for(const dz of [-w*.43,w*.43])box(M.trim,0xb2b1a7,.08,2.85,.08,front+side*.92,1.42,z+dz);
      box(M.trim,0xe5dfd0,.13,.62,w*.73,front+side*.07,3.45,z);
    }else if(type==='house'){
      box(M.trim,0xd4d0c5,1.30,.13,2.1,front+side*.55,2.5,entryZ);for(const dz of [-.89,.89])box(M.trim,0xc4bba9,.12,2.5,.12,front+side*1.1,1.25,entryZ+dz);
    }
    if(h>5&&h<15){box(M.trim,0xd8d5cb,.45,.11,w-.25,front+side*.20,3.15,z);for(let k=0;k<Math.floor(w/.6);k++)box(M.trim,0x686d6e,.025,.65,.025,front+side*.43,3.50,z-w/2+.3+k*.6);box(M.trim,0x686d6e,.025,.025,w-.25,front+side*.43,3.82,z);}
  }
  for(const [mat,geos]of batches){const clean=geos.map(g=>g.index?g.toNonIndexed():g);const g=mergeGeometries(clean);for(const geo of [...new Set([...geos,...clean])])geo.dispose();if(!g)continue;const m=new THREE.Mesh(g,mat);m.castShadow=m.receiveShadow=true;m.userData.realisticArchitecture=true;parent.add(m);}
}
