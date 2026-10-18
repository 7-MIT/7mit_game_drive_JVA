// Frame-time hysteresis: temporary loading spikes do not change graphics quality.
export function initialQuality({mobile=false,memory=8,cores=8}={}){
  return memory<=2||cores<=2?3:mobile||memory<=4||cores<=4?2:0;
}
export function qualityProfile(level){
  const n=Math.max(0,Math.min(5,level));
  return {scale:[1,.9,.8,.7,.6,.5][n],shadowSize:n<2?2048:1024,shadowEvery:[2,3,4,6,8,10][n],shadows:n<4,bloom:n<2,nearLOD:[55,50,45,40,35,30][n],viewScale:[1,1,.9,.8,.7,.65][n],mirrorHz:n<2?20:n<4?10:0};
}
// The Tinggi preset: the player's explicit choice of the richest picture. Every vehicle keeps its full model at any distance,
// sharp shadows refresh every frame over a wider area, the full screen resolution and a longer view; the governor leaves it alone.
export function ultraProfile(mobile=false){
  return {scale:1,shadowSize:mobile?2048:4096,shadowEvery:1,shadows:true,bloom:true,nearLOD:1e4,viewScale:mobile?1.2:1.35,mirrorHz:30,shadowSpan:mobile?140:180,ultra:true};
}
export function createQualityGovernor(level=0){
  const state={level,acc:0,n:0,slow:0,fast:0,cooldown:0,fps:60};
  return {state,reset(next){state.level=Math.max(0,Math.min(5,next));state.acc=state.n=state.slow=state.fast=0;state.cooldown=4;},sample(dt){
    if(!(dt>0&&dt<1))return false;dt=Math.min(dt,.25);
    state.acc+=dt;state.n++;if(state.acc<1)return false;
    state.fps=state.n/state.acc;state.cooldown=Math.max(0,state.cooldown-state.acc);state.acc=state.n=0;
    const low=state.level>=3?27:43;
    state.slow=state.fps<low?state.slow+1:0;state.fast=state.fps>57?state.fast+1:0;
    if(state.cooldown>0)return false;
    if(state.slow>=3&&state.level<5){state.level++;state.slow=state.fast=0;state.cooldown=4;return true;}
    if(state.fast>=12&&state.level>0){state.level--;state.slow=state.fast=0;state.cooldown=8;return true;}
    return false;
  }};
}
// A bounded fixed step keeps traffic/collision integration independent of display Hz.
export function createSimulationClock(step=1/60,maxSteps=4){
  let bank=0;
  return {reset(){bank=0;},advance(dt,tick){bank+=Math.max(0,Math.min(dt,step*maxSteps));let n=0;while(bank+1e-9>=step&&n<maxSteps){tick(step);bank-=step;n++;}return n;}};
}
