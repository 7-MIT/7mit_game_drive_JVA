import * as THREE from 'three';
export const SERVICE_VEHICLES = Object.freeze({
  mbg: {base: 'van', label: 'Mobil MBG', title: 'MBG', subtitle: 'MAKAN BERGIZI GRATIS', color: 0xf8f8f2, accent: '#197b56', mass: 2500, tank: 60, kmL: 9},
  kopdes: {base: 'boxTruck', label: 'Truk Kopdes', title: 'KOPDES', subtitle: 'KOPERASI DESA · DISTRIBUSI', color: 0xf3f5ee, accent: '#c92d33', mass: 8000, tank: 150, kmL: 5}
});
export function brandServiceVehicle(vehicle, type) {
  const spec = SERVICE_VEHICLES[type]; if (!spec) return;
  vehicle.g.userData.serviceVehicle = type;
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = spec.accent; ctx.fillRect(0,0,1024,256);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 112px sans-serif'; ctx.fillText(spec.title,512,92);
  ctx.font = 'bold 36px sans-serif'; ctx.fillText(spec.subtitle,512,199);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({map, roughness: .65}); mat.userData.own = true;
  const w = type === 'mbg' ? 2.5 : 4.1, y = type === 'mbg' ? 1.45 : 2.25;
  for (const side of [-1,1]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),mat);
    mesh.position.set(side*(vehicle.dimensions.width/2+.025),y,type==='mbg'?-.65:-.8);
    mesh.rotation.y=side*Math.PI/2;vehicle.g.add(mesh);
  }
}
