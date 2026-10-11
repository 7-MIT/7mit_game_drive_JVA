# Simulator Tol Trans-Jawa

A browser driving simulator for the road network of Java island (toll roads plus the national highways), built from the Claude Design prototype `project/Freeway Traffic.html`. It drives on the left, follows Indonesian signage, and keeps the prototype's visual language and Modernist HUD.

Open `index.html` from any static web server, for example `python3 -m http.server` in this folder, then visit `http://localhost:8000/`. three.js 0.160 loads from jsDelivr.

## What it does

- **Route planner.** Choose a trip type: *Rute (A → B)* or *Keliling bebas* (free driving, see below). For a route, pick where you start and where you end: a toll gate or a town. You can also use a preset (Jakarta → Surabaya by Pantura, Bandung → Yogyakarta by the Lintas Selatan, Merak → Banyuwangi …).
  - The network in `network.js` has 49 toll roads (including Cawang–Tanjung Priok and Akses Tanjung Priok), including the complete JORR 2 ring (Cengkareng–Kunciran, Kunciran–Serpong, Serpong–Cinere, Cinere–Jagorawi, Cimanggis–Cibitung, Cibitung–Cilincing, about 111 km), with their exits and junctions (simpang susun), plus 45 Jalan Nasional corridors and 169 access roads, about 350 places in all. Access roads into towns on a 4-lane road have 2 lanes each way.
  - Every toll exit links to the nearest town by an access road.
  - Routes are found with Dijkstra on travel time. You choose the road type: toll + national roads (fastest), toll preferred, or national roads only.
- **Keliling bebas (free driving).** There is no fixed route. The road ahead is planned as you go: at each junction, exit or town intersection a panel ("Arah di …") lists the roads you can take, for example *Kiri: Tol JORR → Tj. Priok* or *Keluar: Keluar tol → Bekasi*. Tap one and the road ahead is re-planned from that point; the choice closes about 1 km (world distance) before the place. If you choose nothing, you keep going straight. The world keeps extending as you drive, so you can tour the whole island.
- **Maps (Peta).** The Peta button, the mini-map or the M key opens a full-screen map of every road in the network: toll roads, national roads and access roads, with every exit, junction, rest area and town.
  - Drag to pan. Zoom with the mouse wheel, a pinch or the +/− buttons. "Saya" centres the map on your car.
  - Labels appear as you zoom in.
  - Search for any place by name.
  - Tap a place for its details: type, roads through it, and distance and time from where you are. Tap a road for its name, length, lanes and speed limit.
  - "Navigasi ke sini" turns on GPS-style navigation to that place, in both trip types. The route is recalculated if you miss an exit or leave the planned road. "Hapus navigasi" returns to free driving, and "Mulai keliling dari sini" starts a new free drive from that place.
- **Day and night.** The game has its own clock, shown on the dashboard. Light follows the in-game hour, blending smoothly through dawn (about 05:45), morning, noon, afternoon, sunset (about 18:00) and night.
  - The sun moves across the sky, so shadows change.
  - Street lights, headlights and illuminated signs switch on as it gets dark.
  - "Jalannya jam" sets how fast the clock runs (stopped, 1 hour = 2 min, 1 hour = 1 min, 1 hour = 10 s).
  - "Atur jam" jumps to morning, noon, evening or night.
- **Lane guidance (panduan lajur).** Before an exit you need, a closed lane or a lane that ends, a panel shows every lane with its arrow. The lanes to be in are highlighted and animated, closed lanes are hatched, and a marker slides along with your car's real position. A hint tells you which way to move, or confirms you're in the right lane. Trucks and buses are kept in the left lanes.
  - Tap a lane, in the panel or in the small lane strip on the dashboard, to pick it. Autopilot moves there and holds it for a while; in manual driving the lane stays marked until you reach it.
- **Animated interface.** Panels slide in, dialogs scale in, list rows rise in as new places come up, the speed-limit sign pops when it changes, and the speed blinks when you're over the limit. Buttons respond to presses. Animations are switched off when the system asks for reduced motion.
- **Realistic car handling (manual).**
  - Steering works like a real car (bicycle model): the wheel turns gradually, and much less at motorway speed, so a lane change is a smooth curve. The heading follows from speed, wheelbase and steering angle, limited by tyre grip; push too hard and the tyres skid.
  - The front wheels turn visibly. The body dives under braking, squats when accelerating and rolls in turns.
  - Throttle and brake pressure build up progressively, and an automatic gearbox (D1–D5, shown next to the speed) shifts up with a brief torque dip. A sedan does 0–100 km/h in about 11 s and stops from 100 km/h in about 38 m.
  - "Asisten setir" (off by default) straightens the car when you let go of the wheel; switch it off to counter-steer yourself.
  - AI cars change lanes with the same smooth sideways motion.
- **Drive it.** ↑/W gas, ↓/S brake (hold it at a standstill to reverse), hold ←/→ to steer, P autopilot, C camera, M map. On a phone there are on-screen buttons.
  - **Manual driving is free.** Steering is continuous, so you can drive anywhere the road physically allows: the shoulder, off the road, closed lanes, or the oncoming lane on national roads (to overtake, or head-on into traffic). The toll road's median barrier and guard rail stop you except at openings. Collisions come from real vehicle positions (rear-end, side swipe, head-on). Running red lights or toll gates is possible; it's recorded as a violation, not prevented.
  - **Autopilot always follows the route and the rules.** Turning it on hands the car back into a legal lane.
  - To leave the toll road, steer left onto the ramp when the EXIT sign appears, then stop at the toll gate to tap e-Toll. Junction ramps work too, with no reload. The left-hand ramp takes the road to the left; when the plan turns right there, you get the loop ramp instead. The ramp carries you over the crossing road and back onto the main road, which from that junction on is the toll road you chose; with navigation on, the route is recalculated. Leaving at an exit takes you straight onto the road into town, and a left turn at an intersection carries on along the new road, both without reloading the world.
  - Rest areas work the same way. You park in a bay, then press "Lanjut perjalanan" to continue.
  - When you follow the route through a junction where it changes road, the mainline continues **straight onto the next road**. For example, Japek goes straight into Cipularang; Cikampek → JORR → Jagorawi.
- **National roads (Jalan Nasional).**
  - Corridors: the Pantai Selatan route (Labuan–Bayah–Palabuhanratu–Pangandaran–Cilacap–Kebumen, Yogyakarta–Wonosari–Pacitan, Pacitan–Prigi–Tulungagung), Madura via Suramadu (Bangkalan–Sampang–Pamekasan–Sumenep), Cikampek–Purwakarta–Padalarang, Bogor–Jasinga–Rangkasbitung, Cianjur–Sindangbarang, Malang–Dampit–Lumajang–Jember, Banjar–Pangandaran, Solo–Purwodadi, Kudus–Jepara, Purwokerto–Cilacap, Pantura (Merak–Jakarta–Cirebon–Semarang–Surabaya–Banyuwangi, 4 lanes), Jalan Raya Jakarta–Bogor via Tentara Pelajar–Kebayoran Lama–Ciputat–Pondok Cabe–Sawangan (Depok)–Parung–Kemang (4 lanes), Jakarta–Puncak–Bandung, Ciawi–Sukabumi, Bandung–Sumedang–Cirebon, the Lintas Selatan (Nagreg–Tasikmalaya–Banjar–Kebumen–Yogyakarta), Tegal–Purwokerto, Yogyakarta–Solo–Madiun–Surabaya, Semarang–Solo, Bawen–Magelang, Gempol–Malang, Malang–Blitar–Kediri, and Probolinggo–Jember–Banyuwangi.
  - Divided roads have a planted median; single-lane roads have a double yellow centre line. Villages and rice fields line the road outside towns.
  - Every town has a 50 km/h zone with shophouses, street lights and a "Selamat Datang" sign, plus a signalised intersection with stop lines, zebra crossings, a direction sign and cross traffic that obeys its own light.
  - Motorcycles keep to the left lane.
  - Where the route leaves or joins the toll network you pass through a mainline toll gate: tap out and pay, or tap in.
  - To turn left at an intersection, steer left there, and you continue on the road to the left. In free driving, right turns are made through the "Arah di" panel.
- **Rules and scoring.** The game counts these violations:
  - speeding above the posted limit (from the road data, roadworks and contraflow);
  - trucks and buses outside the left lanes;
  - driving through a toll gate without stopping;
  - running a red light;
  - driving on the shoulder, off the road or against the traffic;
  - entering a closed lane or a staff-only U-turn opening.

  Rear-end crashes and hitting cones are counted separately. Toll is charged at each mainline toll plaza and at the exit (Rp per km, an estimate).
- **AI traffic.** Cars, SUVs, vans, trucks and buses follow the vehicle ahead (IDM model) and obey limits and the heavy-vehicles-left rule. They change lanes, zipper-merge at closures, take exits and rest areas, and enter from on-ramps. Roads alongside the toll road and overpasses have their own traffic.
- **Road construction.**
  - Ramps follow real-world rules: an 8 m junction bridge (5.1 m clearance) and grades of at most about 8 % with parabolic vertical curves.
  - In each cloverleaf quadrant the outer connector wraps around its loop, so no ramps cross at grade.
  - Ramps reach deck height before they pass under the deck.
  - Low ramp sections sit on grassed embankments with 1:1.5 slopes; high sections are viaducts with piers, crossbeams and concrete parapets.
  - Overpasses have earth fills with side slopes and abutment walls. No lamp post stands under a bridge deck or a toll-plaza canopy.
  - A geometry check run during development reports no clashes between ramps, decks, the main road, the parallel road or signs.
- **Interchanges.** Ordinary exits are trumpets with a toll gate on the stem road that connects to the Jalan Nasional. Junctions are Cikunir-style cloverleafs: two loops and two direct ramps per side, with the crossing toll road on a flyover. Mainline toll plazas (Cikupa, Kalihurip, Palimanan, Kalikangkung, Banyumanik, Warugunung, …) have booths across every lane.
- **Roadworks and contraflow.**
  - Roadworks: choose which lanes to close in each direction.
  - Contraflow: the closed U-turn openings ("khusus petugas") open up and police guard the lanes. It can run either way, for some lanes or all of them.
  - All lanes ("one way"): oncoming traffic is diverted through a temporary ramp to the Jalan Nasional and back.
- **Landscape by region** (from published descriptions of each route):
  - Jabodetabek and the big cities (Bandung, Semarang, Surabaya, Yogyakarta, Solo, Malang, Cirebon …) are lined with housing, shops and apartment towers, with no rice fields.
  - Cikarang–Karawang and Cilegon have factories and warehouses.
  - The plains (Pantura, Cipali, Trans-Jawa) have rice fields (young, ripening, flooded) with villages.
  - Cipularang, Bawen–Salatiga, Bocimi, Cisumdawu, Pandaan–Malang and the mountain roads run between green hills.
  - About thirty volcanoes (Salak, Gede-Pangrango, Ciremai, Slamet, Merbabu, Merapi, Lawu, Arjuno, Semeru …) stand on the horizon at their real bearing.
- **U-turns.** Steer all the way round where the road allows it (anywhere on a national road, through a median opening on a toll road) and the trip carries on the other way.
- **Relaxed driving, inspired by slowroads.io.**
  - The trip type "Santai (ala Slow Roads)" starts an endless drive with autopilot, a clean screen, winding and hilly roads, a long view, light traffic and a late afternoon sun.
  - Settings:
    - Cuaca: clear, cloudy, rain, fog. Rain brings falling streaks, a wet dark road and less grip.
    - Gaya jalan: as the terrain, more winding and hilly, or straighter.
    - Jarak pandang: normal or far.
    - Setir otomatis: lane keeping while you work the pedals. Steering by hand picks the next lane.
    - Suara: engine pitch follows speed and gear, plus wind and rain.
    - Tampilan: full or clean. Clean shows only the speed and controls; H or the HUD button switches.
  - The sky is a gradient dome with the sun, drifting clouds that follow the weather, and stars at night.
- **Power lines.**
  - Every PLN electricity pole along the national roads (in towns and outside) carries its wires: three phase wires on the cross-arm, the neutral and a telecom cable, sagging between poles. Poles skip intersections, and you can crash into them.
  - SUTET 500 kV lines (double-circuit lattice towers, about 57 m tall, every 400 m) run beside toll and national roads for long stretches. Each has six conductors on insulator strings and two earth wires.
  - Near interchanges, toll plazas and towns a line swings further out, so no tower stands on a ramp or the parallel road, and wires pass high over everything. Where a line ends it veers away from the road.
  - Some lines cross the road on towers on both sides.
- **Settings take effect immediately, on toll and national roads alike.** The lane count applies to every road and overpasses also cross national roads. Closing lanes or turning on contraflow places a roadworks or contraflow zone a short way ahead of the car if none is near. Every change is confirmed with a message.
- **Signs.** Junction gantries and the 1 km boards name the toll road each ramp leads to (for example "Tol JORR · Pluit / Tj. Priok"), and the through-lane sign names the toll road the carriageway continues as.
- **Other signs.** There are gantry signs (EXIT/JCT plus the next cities), 500 m advance boards, km distance boards after each interchange, KM posts, speed-limit and minimum-speed signs, and warning boards for works and contraflow.
- **Distance scale.** "Nyata 1:1" uses the real distances between exits. "Ringkas 1:5" and "Cepat 1:20" shorten the empty stretches, so a Jakarta–Surabaya drive fits into a session. The HUD always shows real km.
- **Lanes.** Lane counts come from the data per road (for example Cipali has 2, Japek 4). "Lajur tol" can force 2–5 lanes. When the count changes between roads, the lane tapers and traffic has to merge.

## Files

| File | Contents |
| --- | --- |
| `index.html` | HUD, driving controls, route planner, settings panel (Modernist design system) |
| `main.js` | 3D world, traffic simulation, player, cameras, UI wiring |
| `network.js` | Toll network data (roads, exits, KM, coordinates, lanes, limits), routing, Java outline for the mini-map |
| `ds/modernist.css` | Copy of the design-system stylesheet from the handoff bundle |

## How the world is built

The world is built along the chosen route. `u` is the distance in metres along the route, and the camera uses a floating origin (`z = camU − u`). Each route event (exit, junction, rest area, toll plaza) becomes a *site* at its own `u`. The road is built in 120 m chunks around the car, and sites, roadworks, contraflow zones, overpasses and U-turn openings are created as they come into range. The gentle curves come from the same vertex-shader bend the prototype used.

When the plan changes (a choice in free driving, navigation, or the road ahead running out), the layout is recomputed from that point only. Events before it keep their position and identity, so the world already built near the car stays where it is.

`window.__tj` exposes a few test hooks: `step(n)` advances the simulation without rendering, `jump(u)` teleports the car, and `dbg()` reports its state. `startDrive`, `setNav`, `clearNav` and `chooseAt` drive the free-driving features.

## Limitations

- KM posts and coordinates are approximations from public maps. The order of exits is right, but individual KM values can be a few km off. Toll rates are an estimate (Rp 1,000/km for Gol I, Rp 1,650/km for trucks), not the official tariff.
- The road geometry is generic. Ramp layouts are typical shapes, not surveyed layouts of each interchange, and the land around them does not model real terrain.
- National-road distances, town positions and lane counts are approximate. Intersections are generic four-way crossings, and the AI on the main road does not turn.
- Short urban links and toll roads that are still under construction are mostly not included. Probolinggo–Banyuwangi past Besuki is marked as planned (dashed on the map).
- Smaller regional roads (jalan provinsi/kabupaten) are not in the network, so free driving and navigation only use toll, national and access roads.
