// Fictional facilities for the game, connected to the existing town road network.
// These are gameplay locations, not a directory of real SPPG or cooperatives.
export const DELIVERY_JOBS = Object.freeze({
  mbg: {name: 'Pengantar MBG', veh: 'mbg', desc: 'Ambil makanan di SPPG terdekat, lalu antar ke tiga sekolah sesuai daftar tujuan', pay: 'Rp 3.000.000 + Rp 50.000/km per pengiriman', base: 3000000, perKm: 50000, kind: 'delivery', source: 'sppg', target: 'school', count: 3, who: 'paket makanan MBG'},
  kopdes: {name: 'Pengantar Kopdes', veh: 'kopdes', desc: 'Muat barang di Koperasi Desa terdekat, lalu kirim ke toko dan gudang tujuan', pay: 'Rp 3.000.000 + Rp 100.000/km per pengiriman', base: 3000000, perKm: 100000, kind: 'delivery', source: 'kopdes', target: 'cooperative-destination', count: 2, who: 'barang koperasi'}
});

export function registerDeliveryFacilities(nodes, corridors) {
  const facilities = [], anchors = [...nodes.values()].filter(n => n.key.startsWith('N:') && n.kind === 'k' && !n.poi &&
    n.lat < -5.7 && n.lon >= 105.1 && n.lon < 114.62);
  const specs = [
    ['sppg', 'SPPG', -.004, -.003], ['kopdes', 'Koperasi Desa', .004, .003],
    ['school', 'SD Negeri', -.008, .006], ['school', 'SMP Negeri', .009, -.006], ['school', 'SMA Negeri', .012, .008],
    ['cooperative-destination', 'Toko Mitra Kopdes', -.011, -.009], ['cooperative-destination', 'Gudang Distribusi Kopdes', .008, .012]
  ];
  for (const town of anchors) for (const [index, [type, label, dy, dx]] of specs.entries()) {
    const key = `DELIVERY:${town.key}:${index}`, id = `delivery-${town.key}-${index}`;
    const name = `${label} ${town.name}`, km = Math.hypot(dy, dx * Math.cos(town.lat * Math.PI / 180)) * 111.32;
    const facility = {key, name, type, townKey: town.key, city: town.name, lat: town.lat + dy, lon: town.lon + dx};
    facilities.push(facility);
    nodes.set(key, {...facility, kind: 'k', poi: 'delivery', corr: new Set([id])});
    town.corr.add(id);
    corridors.push({id, name: `Jalan akses ${name}`, short: `Akses ${name}`, cls: 'n', prov: true, custom: true,
      serviceAccess: true, lanes: 1, limit: 30, region: 'jawa', nodes: [
        {key: town.key, name: town.name, kind: 'k', km: 0}, {key, name, kind: 'k', km}
      ]});
  }
  return facilities;
}
const distance = (a, b) => Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos((a.lat + b.lat) * Math.PI / 360));
export function planDelivery(kind, here, facilities, reachable = () => true) {
  const job = DELIVERY_JOBS[kind];
  if (!job || !Number.isFinite(here?.lat) || !Number.isFinite(here?.lon)) return null;
  const sources = facilities.filter(f => f.type === job.source).sort((a,b) => distance(here,a) - distance(here,b));
  for (const source of sources) {
    if (!reachable(source.key)) continue;
    const targets = facilities.filter(f => f.type === job.target && f.townKey === source.townKey)
      .sort((a,b) => distance(source,a) - distance(source,b)).slice(0,job.count);
    if (targets.length !== job.count) continue;
    return [{...source, kind: 'pick'}, ...targets.map(f => ({...f, kind: 'drop'}))];
  }
  return null;
}
