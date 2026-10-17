// SI units, deterministic dynamics used by the manual and autopilot controllers.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const BICYCLE = Object.freeze({label:'Sepeda',vmax:16,cruise:8.6,mass:95,wheelbase:1.12,wheelRadius:0.35,cdA:0.42,rolling:0.006,power:225,maxForce:150,brake:5.2});
export const isTwoWheeler = type => type==='bicycle'||type==='moto';
export const nonTollVehicle = type => isTwoWheeler(type);
export function bicycleAcceleration({speed=0,pedal=0,brake=0,grade=0,stamina=100,wet=false,offroad=false,damage=0}){
  const v=Math.max(0,speed),effort=clamp(pedal,0,1),fatigue=0.45+0.55*clamp(stamina,0,100)/100;
  const drive=Math.min(BICYCLE.maxForce,BICYCLE.power*fatigue/Math.max(v,1))*effort*(1-clamp(damage,0,80)/160);
  const aero=0.5*1.225*BICYCLE.cdA*v*v,roll=v>0.02?BICYCLE.mass*9.81*(offroad?0.035:BICYCLE.rolling):0;
  const stopping=clamp(brake,0,1)*BICYCLE.brake*BICYCLE.mass*(wet?0.68:1),hill=BICYCLE.mass*9.81*clamp(grade,-0.35,0.35);
  return (drive-aero-roll-stopping-hill)/BICYCLE.mass;
}
export function staminaStep(stamina,pedalling,dt){return clamp(stamina+(pedalling?-0.18:0.5)*dt,0,100);}
// Stable spring/damper with small substeps, so 30/60/120 Hz produce the same ride.
export function springStep(position,velocity,target,frequency,damping,dt){
  const n=Math.max(1,Math.ceil(Math.min(dt,0.1)*120)),h=Math.min(dt,0.1)/n,w=2*Math.PI*frequency;
  for(let i=0;i<n;i++){velocity+=((target-position)*w*w-2*damping*w*velocity)*h;position+=velocity*h;}
  return {position,velocity};
}
export function ackermannAngle(steer,wheelX,wheelbase){
  if(Math.abs(steer)<0.0001)return 0;
  return Math.atan(wheelbase/(wheelbase/Math.tan(steer)-wheelX));
}
export function roadResistance(speed,{mass=1300,cdA=0.66,rolling=0.012}={}){
  return Math.sign(speed)*(0.5*1.225*cdA*speed*speed/mass+9.81*rolling);
}
export const FOOD_BICYCLE_JOB = Object.freeze({name:'Kurir makanan · sepeda',veh:'bicycle',desc:'Kayuh ke warung, ambil pesanan, lalu antar melalui jalan non-tol',pay:'Rp 3.000.000 + Rp 25.000/km',base:3000000,perKm:25000,kind:'ride',who:'pesanan',bicycle:true});
