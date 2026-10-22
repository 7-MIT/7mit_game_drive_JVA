// Runs osm-route.js off the main thread: {id, roads, P, kinds, use} in, {id, segs} out (one path per stretch, null where none).
import {routeCorridor} from './osm-route.js';
onmessage = e => { const {id, roads, P, kinds, use} = e.data; let segs = null; try { segs = routeCorridor(roads, P, {kinds}, use); } catch (err) {} postMessage({id, segs}); };
