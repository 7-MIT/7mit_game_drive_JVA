import * as THREE from 'three';
// Reusable detail for the player's vehicle only; AI keeps its inexpensive LOD.
export function detailPlayerVehicle(v){
  if(!v||v.type==='bicycle'||v.detailed)return;v.detailed=true;
  const rubber=new THREE.MeshStandardMaterial({color:0x222326,roughness:0.94}),alloy=new THREE.MeshStandardMaterial({color:0xb4b9bf,metalness:0.9,roughness:0.26}),rotor=new THREE.MeshStandardMaterial({color:0x70777e,metalness:0.85,roughness:0.42});
  for(const m of [rubber,alloy,rotor])m.userData.own=true;
  for(const w of v.wh){
    // Wheel meshes are normalized cylinders (x=width, y/z=radius).
    for(const side of [-1,1]){
      const ringGeo=new THREE.TorusGeometry(0.79,0.022,5,24);ringGeo.rotateY(Math.PI/2);const ring=new THREE.Mesh(ringGeo,rubber);ring.position.x=side*0.49;w.add(ring);
      const discGeo=new THREE.CylinderGeometry(0.46,0.46,0.025,24);discGeo.rotateZ(Math.PI/2);const disc=new THREE.Mesh(discGeo,rotor);disc.position.x=side*0.46;w.add(disc);
      for(let i=0;i<5;i++){const a=i/5*Math.PI*2,bar=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.085,0.58),alloy);bar.position.set(side*0.54,Math.sin(a)*0.31,Math.cos(a)*0.31);bar.rotation.x=-a;w.add(bar);}
    }
  }
  if(['car','suv','taxi','police','pickup'].includes(v.type)){
    const fabric=new THREE.MeshStandardMaterial({color:0x282c31,roughness:0.94}),dash=new THREE.MeshStandardMaterial({color:0x1c2025,roughness:0.82});fabric.userData.own=dash.userData.own=true;
    const add=(w,h,d,x,y,z,m)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);v.g.add(mesh);return mesh;};
    for(const side of [-1,1]){add(0.47,0.16,0.55,side*0.42,0.6,-0.05,fabric);const back=add(0.47,0.53,0.13,side*0.42,0.86,-0.28,fabric);back.rotation.x=-0.12;add(0.25,0.16,0.12,side*0.42,1.17,-0.3,fabric);}
    add(1.35,0.17,0.32,0,0.94,0.72,dash);
    const steering=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.018,6,20),dash);steering.position.set(0.4,1.03,0.48);steering.rotation.x=-0.45;v.g.add(steering);
    // Glazing reveals the seats while retaining reflected sky highlights.
    let glass=null;v.g.traverse(o=>{if(o.isMesh&&o.material?.userData?.realGlass)return;if(o.isMesh&&o.material?.color?.getHex()===0x141c24){if(!glass){glass=new THREE.MeshPhysicalMaterial({color:0x8aadb8,roughness:0.08,metalness:0.05,transparent:true,opacity:0.62,depthWrite:false,clearcoat:1});glass.envMap=o.material.envMap;glass.envMapIntensity=o.material.envMapIntensity;glass.userData.own=true;glass.userData.realGlass=true;}o.material=glass;}});
  }
}
export function roadSurface(material,maxAnisotropy=4){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const x=canvas.getContext('2d'),image=x.createImageData(256,256);let seed=1137;
  for(let i=0;i<image.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=195+(seed%60);image.data[i]=image.data[i+1]=image.data[i+2]=v;image.data[i+3]=255;}
  x.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(5,18);texture.anisotropy=Math.min(4,maxAnisotropy);
  material.bumpMap=texture;material.bumpScale=0.009;material.roughnessMap=texture;material.needsUpdate=true;return texture;
}
