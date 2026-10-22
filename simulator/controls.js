// Extra controls: gamepads and steering wheels (Gamepad API), tilt steering on phones, and the manual gearbox with or without a clutch.
// Analog values go into the shared input object: steerA (−1 left … 1 right), gasA and brakeA (0 … 1); the digital flags stay in step.

// ---- manual gearbox ----
// each gear pulls from lo to top (m/s, for a car; heavy vehicles multiply by hv); below lo the engine lugs, below stall speed it dies
// fifth gear runs on to the 200 km/h limit (the vehicle's own top speed cuts in there)
export const GEAR_TOP = [10, 18, 27, 38, Infinity], GEAR_PULL = [1, 0.8, 0.64, 0.52, 0.43];
export const gearLow = g => g <= 1 ? 0 : GEAR_TOP[g - 2]*0.5;
// drive force factor, engine rpm and whether the engine stalls, for gear g (0 = neutral) at speed vel
export function manualDrive({gear, vel, clutch = false, hv = 1, gas = 0, clutchMode = false}){
  const v = Math.max(0, vel)/hv, rpmOf = g => g <= 0 ? 0 : 800 + v/(g >= 5 ? 56/hv : GEAR_TOP[g - 1])*5600;
  if (gear <= 0 || clutch) return {k: 0, rpm: 800 + gas*4200*(gear <= 0 || clutch ? 1 : 0), stall: false, limiter: false};
  const top = GEAR_TOP[gear - 1], lo = gearLow(gear), rpm = Math.max(800, rpmOf(gear));
  if (v >= top) return {k: 0, rpm: 6400, stall: false, limiter: true};
  // lugging: too high a gear for the speed; with a clutch to work, the engine dies when the car nearly stops in gear
  if (v < lo) { const stall = clutchMode && v < lo*0.45 && !(gear === 1); return {k: GEAR_PULL[gear - 1]*0.3*Math.max(0.2, v/lo), rpm, stall, limiter: false}; }
  return {k: GEAR_PULL[gear - 1], rpm, stall: false, limiter: false};
}
// can the driver change gear now? Without a clutch to work (kopling otomatis) always; otherwise only with the clutch down or at a standstill
export const shiftOK = ({clutchMode, clutch, vel}) => !clutchMode || clutch || Math.abs(vel) < 0.3;

// ---- gamepads and wheels ----
const DEAD = 0.08, dz = x => Math.abs(x) < DEAD ? 0 : (x - Math.sign(x)*DEAD)/(1 - DEAD);
// a wheel or other non-standard controller: steering on axis 0, pedals are the axes that rest at ±1 (gas, brake, clutch in that order)
export function readPad(p, rest){
  const out = {steer: 0, gas: 0, brake: 0, clutch: 0, btn: {}};
  if (p.mapping === 'standard') {
    out.steer = dz(p.axes[0] || 0); out.gas = p.buttons[7]?.value || 0; out.brake = p.buttons[6]?.value || 0;
    const b = i => !!p.buttons[i]?.pressed; out.btn = {clutch: b(0), horn: b(1), hazard: b(2), cam: b(3), down: b(4), up: b(5), map: b(8), left: b(14), right: b(15), photo: b(9)};
  } else {
    out.steer = Math.max(-1, Math.min(1, (p.axes[0] || 0)*1.6));
    const ped = []; for (let i = 1; i < p.axes.length; i++) if (rest && Math.abs(Math.abs(rest[i] ?? 0) - 1) < 0.15) ped.push(Math.min(1, Math.abs((p.axes[i] ?? rest[i]) - rest[i])/2));
    [out.gas = 0, out.brake = 0, out.clutch = 0] = ped;
    const b = i => !!p.buttons[i]?.pressed; out.btn = {up: b(4), down: b(5), horn: b(0), cam: b(3), clutch: out.clutch > 0.5};
  }
  return out;
}
export function createPads({input, on = {}}){
  const rest = new Map(); let prev = {}, used = false;
  addEventListener('gamepadconnected', e => { rest.set(e.gamepad.index, [...e.gamepad.axes]); on.connect && on.connect(e.gamepad); });
  addEventListener('gamepaddisconnected', e => { rest.delete(e.gamepad.index); release(); on.disconnect && on.disconnect(e.gamepad); });
  function release(){ if (!used) return; used = false; Object.assign(input, {steerA: 0, gasA: 0, brakeA: 0, gas: false, brake: false, clutch: false}); prev = {}; }
  return {poll(){
    const list = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []; if (!list.length) return release();
    const p = list[0]; if (!rest.has(p.index)) rest.set(p.index, [...p.axes]); const r = readPad(p, rest.get(p.index));
    const active = Math.abs(r.steer) > 0.02 || r.gas > 0.03 || r.brake > 0.03 || Object.values(r.btn).some(Boolean);
    if (!active && !used) return; if (active && !used) { used = true; on.active && on.active(); }
    input.steerA = r.steer; input.gasA = r.gas; input.brakeA = r.brake; input.gas = r.gas > 0.05; input.brake = r.brake > 0.08; input.clutch = !!r.btn.clutch || r.clutch > 0.5;
    for (const [k, v] of Object.entries(r.btn)) { if (v && !prev[k] && on[k]) on[k](true); if (!v && prev[k] && on[k + 'Up']) on[k + 'Up'](); }
    prev = r.btn; }, get used(){ return used; }};
}

// ---- tilt steering (phones and tablets): turn the device like a steering wheel ----
export function tiltSteer(e, angle){ const a = ((angle % 360) + 360) % 360, x = a === 90 ? e.beta : a === 270 ? -e.beta : e.gamma;
  if (x == null) return 0; const d = Math.abs(x) < 3 ? 0 : x - Math.sign(x)*3; return Math.max(-1, Math.min(1, d/24)); }
export async function startTilt(input){
  try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return null; } } catch (e) { return null; }
  const h = e => { input.steerA = tiltSteer(e, screen.orientation ? screen.orientation.angle : (window.orientation || 0)); };
  addEventListener('deviceorientation', h); return () => { removeEventListener('deviceorientation', h); input.steerA = 0; }; }
