import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
let materials=null;
function canvasTexture(draw,size=256){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t.userData.keep=true;return t;}
function getMaterials(){if(materials)return materials;
  const wall=canvasTexture((x,s)=>{x.fillStyle='#edeae4';x.fillRect(0,0,s,s);let a=91;for(let i=0;i<6000;i++){a=(Math.imul(a,1664525)+1013904223)>>>0;const v=180+a%60;x.fillStyle=`rgba(${v},${v},${v},.15)`;x.fillRect(a%s,(a>>>8)%s,1,1);}x.fillStyle='#b3b6b6';x.fillRect(39,52,178,161);x.fillStyle='#283b46';x.fillRect(45,58,166,149);x.fillStyle='#58727f';x.fillRect(50,64,75,137);x.fillStyle='#79929b';x.fillRect(55,68,66,6);x.fillStyle='#c4c4bc';x.fillRect(125,58,5,149);x.fillRect(45,130,166,4);x.fillStyle='#a1a6a5';x.fillRect(34,213,188,8);x.fillStyle='#d5d4ce';x.fillRect(36,48,184,5);});
  const roof=canvasTexture((x,s)=>{x.fillStyle='#9c5d46';x.fillRect(0,0,s,s);for(let j=0;j<8;j++)for(let i=0;i<8;i++){const xx=i*32+(j%2?16:0),yy=j*32;x.fillStyle=(i+j)%3?'#af7056':'#8f513e';x.fillRect(xx,yy,30,28);x.fillStyle='#c68b69';x.fillRect(xx+3,yy+2,4,23);x.fillStyle='#633c30';x.fillRect(xx,yy+27,31,4);}});
  const metal=canvasTexture((x,s)=>{x.fillStyle='#c4c7c9';x.fillRect(0,0,s,s);for(let i=0;i<s;i+=16){x.fillStyle='#a6abad';x.fillRect(i,0,3,s);x.fillStyle='#e0e1df';x.fillRect(i+3,0,2,s);}});
  const mat=(o)=>{const m=new THREE.MeshStandardMaterial(o);m.userData.terrain=true;return m;};
  materials={wall:mat({color:0xffffff,map:wall,vertexColors:true,roughness:.89}),roof:mat({color:0xffffff,map:roof,roughness:.84,vertexColors:true}),metal:mat({color:0xffffff,map:metal,metalness:.30,roughness:.60,vertexColors:true}),trim:mat({color:0xffffff,vertexColors:true,roughness:.72}),glass:mat({color:0x39515d,roughness:.18,metalness:.45}),wood:mat({color:0x574231,roughness:.86})};return materials;
}
export function architectureMaterials(){return Object.values(getMaterials());}
export function buildArchitecture(parent,buildings){
  const M=getMaterials(),batches=new Map(),tmp=new THREE.Color();
  const add=(geo,mat,color=0xffffff)=>{if(mat.vertexColors){const c=tmp.set(color),ca=new Float32Array(geo.attributes.position.count*3);for(let i=0;i<ca.length;i+=3){ca[i]=c.r;ca[i+1]=c.g;ca[i+2]=c.b;}geo.setAttribute('color',new THREE.BufferAttribute(ca,3));}if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(geo);};
  const box=(mat,color,w,h,d,x,y,z)=>{const g=new THREE.BoxGeometry(w,h,d);const uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++){const face=Math.floor(i/4),horizontal=face<2?d:face<4?w:w,vertical=face<2?h:face<4?d:h;uv.setXY(i,uv.getX(i)*horizontal/2.5,uv.getY(i)*vertical/3.1);}g.translate(x,y,z);add(g,mat,color);};
  const face=(points,mat,color)=>{const p=[],uv=[],idx=[];points.forEach(([x,y,z],i)=>{p.push(x,y,z);uv.push(i===1||i===2?Math.max(1,points[0][0]===points[1][0]?Math.abs(points[0][2]-points[1][2]):Math.abs(points[0][0]-points[1][0])):0,i>1?2:0);});for(let i=1;i<points.length-1;i++)idx.push(0,i,i+1);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();add(g,mat,color);};
  for(const b of buildings){const {x,z,d,w,h}=b,color=b.color??0xd6cfc0,near=Math.abs(x)<155,type=b.type||(h>18?'tower':d>22?'warehouse':'house');
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
