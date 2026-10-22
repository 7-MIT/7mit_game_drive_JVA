// Runs osm-route.js off the main thread: {id, roads, a, b, kinds} in, {id, path} out (path null when no sensible route).
import {routeOSM} from './osm-route.js';
onmessage = e => { const {id, roads, a, b, kinds} = e.data; let path = null; try { path = routeOSM(roads, a, b, {kinds}); } catch (err) {} postMessage({id, path}); };
