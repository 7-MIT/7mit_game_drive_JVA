// Rain on the windscreen (cockpit view): drops gather on the glass, run down a little, and the wipers sweep them away.
export function createGlass(){
  const c = document.createElement('canvas'); c.id = 'glass'; c.setAttribute('aria-hidden', 'true');
  Object.assign(c.style, {position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1', display: 'none'});
  document.getElementById('stage')?.after(c);
  const x = c.getContext('2d'); let drops = [], wipe = 0, on = false, W = 0, H = 0;
  const size = () => { const k = Math.min(1, 900/Math.max(innerWidth, 1)); W = c.width = Math.round(innerWidth*k); H = c.height = Math.round(innerHeight*k); };
  addEventListener('resize', () => on && size());
  // wiper arm pivots at the bottom; it sweeps from right to left and back once every period
  const PERIOD = 1.3;
  function draw(dt, rain, speed){
    if (!rain) { if (on) { on = false; c.style.display = 'none'; drops = []; } return; }
    if (!on) { on = true; c.style.display = 'block'; size(); }
    const rate = rain*(30 + speed*1.6); for (let i = 0; i < rate*dt; i++) drops.push({x: Math.random()*W, y: Math.random()*H*0.8, r: 1 + Math.random()*3.2*(W/900), v: 0});
    if (drops.length > 600) drops.splice(0, drops.length - 600);
    wipe = (wipe + dt/PERIOD) % 1; const a = Math.PI*(wipe < 0.5 ? 0.15 + 0.7*wipe*2 : 0.85 - 0.7*(wipe - 0.5)*2), px = W*0.3, py = H*1.05, len = H*1.0;
    const ax = px + Math.cos(Math.PI - a)*len, ay = py - Math.sin(Math.PI - a)*len;
    x.clearRect(0, 0, W, H);
    drops = drops.filter(d => { const cross = (ax - px)*(d.y - py) - (ay - py)*(d.x - px), dist = Math.abs(cross)/len; if (dist < 18*(W/900) && Math.hypot(d.x - px, d.y - py) < len) return false;
      if (d.r > 2.6*(W/900)) { d.v += dt*40; d.y += d.v*dt; } return d.y < H; });
    for (const d of drops) { const gr = x.createRadialGradient(d.x - d.r*0.3, d.y - d.r*0.3, 0, d.x, d.y, d.r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.6, 'rgba(200,215,225,.18)'); gr.addColorStop(1, 'rgba(40,50,60,.25)');
      x.fillStyle = gr; x.beginPath(); x.ellipse(d.x, d.y, d.r*0.85, d.r, 0, 0, Math.PI*2); x.fill(); }
    x.strokeStyle = 'rgba(15,15,15,.9)'; x.lineWidth = 7*(W/900); x.lineCap = 'round'; x.beginPath(); x.moveTo(px, py); x.lineTo(ax, ay); x.stroke();
  }
  return {draw};
}
