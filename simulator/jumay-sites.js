// Fictional game sites. Horizontal scales define land area, independently of tower height.
export const JUMAY_PARKS = Object.freeze([
  ['jakarta', 'Jakarta', -6.1884, 106.8233, 1],
  ['bandung', 'Bandung', -6.9130, 107.6040, .90],
  ['semarang', 'Semarang', -6.9850, 110.4250, .85],
  ['yogyakarta', 'Yogyakarta', -7.7956, 110.3695, .80],
  ['surabaya', 'Surabaya', -7.2760, 112.7310, .95]
].map(([id, city, lat, lon, landScale]) => Object.freeze({
  id, city, lat, lon, landScale, kind: 'jumay', headquarters: id === 'jakarta',
  name: `Kawasan Jumay Park ${city} — Jumay Corporation`,
  radius: 190 * landScale, halfDepth: 295 * landScale,
  landWidth: 380 * landScale, landDepth: 590 * landScale,
  landArea: 380 * 590 * landScale ** 2
})));
export const JUMAY_LANDMARK = JUMAY_PARKS[0];

