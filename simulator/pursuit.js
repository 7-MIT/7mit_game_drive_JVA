// A small deterministic game state machine; police driving is handled by main.js.
export function createPursuit(){
  const state={phase:'idle',offences:[],started:0,hold:0,cooldown:0,arrests:0};
  return {state,
    offence(code,time){if(time<state.cooldown||state.phase==='arrested')return false;state.offences=state.offences.filter(e=>time-e.time<=120);if(state.offences.some(e=>e.code===code&&time-e.time<15))return false;state.offences.push({code,time});if(state.offences.length>=3&&state.phase==='idle'){state.phase='chasing';state.started=time;state.hold=0;return true;}return false;},
    step({time,near=false,stopped=false,dt=0}){if(state.phase!=='chasing')return false;state.hold=near&&stopped?state.hold+dt:0;if(state.hold>=3){state.phase='arrested';state.arrests++;return true;}return false;},
    release(time){state.phase='idle';state.offences=[];state.hold=0;state.cooldown=time+45;},
  };
}
