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
- **Real physics.**
  - Collisions use each vehicle's mass (motorbike 220 kg, car 1.3 t, ambulance 2.7 t, bus 11 t, truck 15 t) and conserve momentum; crumple zones absorb the energy, so vehicles hardly bounce apart (no ping-ponging). A rear-end hit shoves the car ahead; hitting a truck stops you dead; a head-on is violent. An off-centre hit spins the car, and a side swipe knocks the lighter vehicle sideways.
  - Vehicles that are hit brake to a stop, put their spin angle on, and stay there for a while.
  - Guard rails and the median barrier make the car scrape along: the steeper the angle, the more speed it loses, and the car is straightened along the wall instead of bouncing off. Hitting a solid object stops the car dead.
  - Gravity acts along the road: the car slows on climbs and speeds up downhill, even when coasting.
  - Crash severity (from the change in speed) sets the camera shake and the message ("parah" for hard crashes).
  - Tyres have a friction circle: grip used for braking or accelerating is not available for steering, so braking hard in a bend makes the car run wide. Grip is lower in the rain (longer braking distance) and for heavy vehicles. Hard braking and sliding leave skid marks.
  - A hit never throws the car through the median barrier or the guard rail into the other carriageway, and does not spin it right round. Slopes never roll a stopped car backwards; it only reverses when you hold the brake.
  - Crash effects: debris in the car's colour, glass shards, sparks (also when scraping a barrier), dust, a dented body (shorter at the front or back, narrower at the side), crash and glass sounds.
  - Damage (shown as % next to the crash count): it cuts engine power and top speed, reduces grip and pulls the car to one side. Above 35 % the engine smokes, above 85 % it burns, and at 100 % the engine dies; after a short wait for the tow truck the car is patched up so you can carry on slowly.
- **Drive it.** ↑/W gas, ↓/S brake (hold it at a standstill to reverse), hold ←/→ to steer, K horn (hold), N siren (emergency vehicles), E get out of / back into the car, F full screen, P autopilot, C camera, M map. On phones, tablets and desktops the on-screen controls sit like a phone's: ◀ ▶ bottom-left, REM and GAS bottom-right. As soon as you drive with the keyboard they hide; touching the screen brings them back.
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
- **AI traffic.** Cars, SUVs, pickups, vans, angkot (national roads only, they stop at the kerb now and then to pick up passengers), trucks and buses follow the vehicle ahead (IDM model) and obey limits and the heavy-vehicles-left rule. They change lanes, zipper-merge at closures, take exits and rest areas, and enter from on-ramps. Roads alongside the toll road and overpasses have their own traffic.
- **Emergency vehicles.** Ambulances, fire engines (damkar) and police cars drive in traffic. Sometimes they are on a call (siren and flashing lights on), sometimes driving normally. On a call:
  - traffic ahead moves aside and slows, opening a corridor between lanes (lane 0 toward the median, the others outward);
  - in a jam on a toll road the vehicle takes the shoulder; on a national road it runs against the flow on the centre line while oncoming traffic pulls over and stops;
  - it ignores red lights, and a message tells you when one comes up behind you.
  You can also drive a Pickup, Angkot, Ambulans, Damkar or Polisi yourself (vehicle choice in the planner). Turn the siren on with N or the Sirene button and the traffic gives way to you; with the siren on, speeding, the shoulder and driving against the flow are not counted as violations.
- **Sound (adaptive).** Engine by rpm and gear, tyres (with a hiss on a wet road), wind, and the roar of passing traffic. Rain sound when it rains, with thunder and lightning flashes. Birds by day and crickets at night outside towns, and a city hum in towns. Drivers stuck in a jam honk now and then (more on national roads, motorbikes and angkot most), and honk at you when you block them. Sirens are per vehicle: hi-lo for ambulances, wail for fire engines, yelp for police, panned left/right and Doppler-shifted. There are also crash sounds and the e-toll beep. Sound starts on the first tap or key press.
- **On foot.** Stop and press E (or "Keluar mobil") to get out. Walk with ↑/↓ (or GAS/REM), turn with ←/→, hold Shift to run. Traffic brakes for you and honks; if a vehicle hits you, you fall and get up again. Walk back to your car (within 5 m) and press E to get in.
- **Realistic vehicles.** Every vehicle is built from a real side profile extruded across its width: sloping hood and windscreen, glasshouse with pillars, roof and boot for sedans (also the Bluebird-style taxi and police car); a taller body with roof rails for SUVs; cab and load bed for pickups; one-box minibuses (van, ambulance, angkot) with a window band; cab-over trucks, fire engines and tow trucks with rounded cab fronts; buses with a deep window band and destination board. All have rims, bumpers, grille, head and tail lights, door mirrors and number plates.
- **Taxis and motorbikes.** Blue taxis with a lit TAXI sign drive in the cities. You can also choose Taksi or Motor. A motorbike leans into bends and, as in reality, is never routed onto a toll road.
- **Tow truck (derek).** After a bad crash, an engine failure (100 % damage, called automatically) or an empty tank, press "Panggil derek" (or T). A yellow tow truck with amber lights comes along the shoulder and stops in front of you. For an empty tank it brings 10 L of emergency fuel. Otherwise it winches the car onto its bed and takes it to the nearest workshop, where the car is repaired; the clock moves on and the tow and repair are paid from your cash.
- **Trip needs.** The dashboard shows fuel (BBM), cash (Tunai), e-Toll balance and drowsiness (Kantuk).
  - Fuel is used by real distance and vehicle (a car does about 13 km/L). An empty tank stops the engine.
  - Tolls are paid from the e-Toll balance.
  - Drowsiness builds while driving, faster at night. It brings warnings, and microsleeps at 100 %.
- **Rest areas full of services.** Food court, minimarket, coffee kiosk, musala, toilets, ATM, SPBU, workshop (bengkel) and EV chargers (SPKLU), each with its sign. When you park in a bay (or walk around the rest area, or stop in a town on a national road) the "Layanan" menu (or L) opens:
  - full tank;
  - tyre pressure;
  - meals, coffee and snacks (less drowsiness);
  - e-Toll top-up;
  - cash from the ATM;
  - repairs;
  - toilet and musala;
  - a 30-minute nap.
  Each shows its price.
- **Siren button.** When you drive an ambulance, fire engine or police car, the Sirene button (or N) switches the siren and lights on and traffic gives way.
- **Multiplayer (real time).** Choose "Multiplayer" in the planner and pick a username (no login).
  - **Spawn:** every player starts parked on the shoulder at Semanggi (Tol Dalam Kota). Players line up one behind the other, 9 m apart, in the order they join.
  - **Connection:** the game connects to server.7mit (the 7MIT Supabase project, Realtime over WebSocket). Players are exchanged as road + km + direction + lane, so you see the others on your own copy of the road, in their vehicle, colours and plates, with a name tag. Everyone also shows on the mini-map.
  - **Panel:** lists who is online and has a text chat (Enter to type). Drag it by its title bar to any place on the screen; the place is remembered.
  - **Voice chat:** goes over WebRTC (one link per player, signalled through the same channel). Press Suara to hear others and Mic to talk; others sound louder when they are close.
  - **Limits:** no TURN server, so a few strict networks may not connect for voice. The free Realtime plan suits small groups (about 20 players).
- **Server settings (multiplayer).** One server has one set of conditions. In multiplayer an ordinary player cannot change any setting; only personal settings stay free (kept on the device, never sent to the server): camera, sound, HUD, steering assist (Asisten setir) and auto steering (Setir otomatis). Traffic, weather, road style, time of day and clock speed, lanes, closed lanes, contraflow, overpasses and distance scale come from the server when joining, and the game clock is shared.
  - **Admin:** in Pengaturan, "Masuk admin (PIN)" opens a PIN box. The PIN is checked by the server (table `drive7_server` and function `drive7_set_settings` in server.7mit; only a SHA-256 hash of the PIN is stored there). After 20 wrong attempts the PIN check is locked for 10 minutes.
  - **Changes:** the admin's changes are saved on the server and sent to all players at once.
- **Music.** The Musik button (or U) opens a small player you can drag and minimise; the music keeps playing while you drive, and the game sound is turned down while it plays.
  - **Paste a link:** YouTube or YouTube Music (single songs and playlists), Spotify (track, album, playlist, podcast), SoundCloud, Apple Music, Deezer, or a direct audio file (.mp3, .m4a, .ogg, …).
  - **Type a song title to search:** full songs come from YouTube through public no-key search mirrors. If none of them answers, the search falls back to the iTunes catalogue with 30-second previews and a link to YouTube.
  - **Limits:** Spotify plays full songs only for logged-in Spotify users (otherwise 30-second previews).
  - **Recent:** the last four played are listed for a quick replay.
- **Kick and ban (admin).**
  - **What is recorded:** when a player joins, the server (edge function `drive7-presence` in server.7mit) records their username, IP address, device type, OS and browser. Each device keeps a stable player id.
  - **Kelola pemain:** in admin mode, "Kelola pemain" lists the players of the last 3 hours with these details, with Kick, Ban 1 jam and Ban permanen. Banned players (by IP and player id) are listed with "Buka blokir".
  - **Kick:** stored on the server first, so another player cannot fake it. The kicked player is checked by the server and leaves multiplayer at once (and every 30 s anyway).
  - **Ban:** a banned player cannot join.
  - **Privacy:** IP and device data are only readable through the PIN-checked admin functions, never by other players.
- **Angry drivers.** Hit another car hard enough and it pulls over onto the shoulder.
  - The driver gets out, waves their arms and shouts in a speech bubble ("Woi! Bisa nyetir gak sih?!", "Ganti rugi pokoknya!" …).
  - If you stop nearby they walk up to your car. "Minta maaf" (handshake button) pays for the damage and settles it.
  - If you drive off, they give up after a while, get back in and drive on.
- **Headlights at night.** Headlights and tail lights come on automatically with the clock (off by day). At night every nearby vehicle throws a pool of light on the road, and your own car has real headlight beams that light the road and the cars ahead.
- **Smooth on tablets and phones.**
  - AI vehicles are merged into a few meshes each, cached per model. Small parts share one material; far-away wheels are not drawn; vehicles behind the camera are not drawn (except as far as the mirrors look).
  - Mirrors are rendered every second or third frame.
  - If the frame rate stays below about 38 fps, the graphics step down automatically: shadows less often, then lower resolution, no glow, no shadows.
- **Icons.** All buttons have line icons; on narrow screens the small buttons show only their icon in one row.
- **Vehicle mods.** In the planner under "Modifikasi kendaraan":
  - paint (swatches or any colour);
  - rim colour;
  - window tint (clear, 40 %, 80 %);
  - rear spoiler;
  - lowered suspension;
  - sport stripes;
  - your own number plate and plate type.
  Mods are saved and other players see them too.
- **Indonesian number plates.** Plates follow the real format: region code, number and letters (e.g. "B 1234 SIM"), with the expiry month · year below and a border. The colour follows the category:
  - white with black text: private;
  - yellow: public transport (taxis, angkot, buses, trucks, tow trucks);
  - red: government (dinas, e.g. fire engines);
  - black: Polri;
  - blue: diplomatic corps ("CD …");
  - green: free-trade zone;
  - white with a blue strip: electric vehicles.
  Region codes follow where a vehicle appears: A, B, F, T, D, Z, E, G, R, AA, H, K, AB, AD, AE, AG, S, L, W, N, P, M.
- **Mirrors (spion).** Working mirrors: rear-facing cameras shown mirror-reversed. In the chase view there is the interior mirror at the top (looking out through the rear window); in the cockpit view also the left and right door mirrors. Toggle with V or the Spion button.
- **Full screen.** The "Layar penuh" button (or F) switches to full screen and, on phones, tries to lock landscape. It is hidden where the browser does not support it.
- **Horn.** Hold K or the Klakson button. Drivers ahead in your lane move over when they can.
- **Landmarks.** Monuments, temples, mosques, towers and bridges stand beside the road at their real place when the route passes within 9 km, on the correct side, and a message names them as you approach:
  - Jakarta and around: Monas, Masjid Istiqlal, Bundaran HI, Masjid Kubah Emas, Tugu Kujang, Istana Bogor;
  - Banten and West Java: Masjid Agung Banten, Keraton Kasepuhan, Masjid Raya Al Jabbar, Gedung Sate;
  - Central Java and Yogyakarta: Lawang Sewu, Tugu Muda, Masjid Agung Jawa Tengah, Sam Poo Kong, Pagoda Watugong, Menara Kudus, Borobudur, Prambanan, Tugu Yogyakarta, Masjid Raya Sheikh Zayed;
  - East Java: Candi Brahu, Candi Bajang Ratu, Tugu Pahlawan, Monumen Kapal Selam, Jembatan Suramadu, Masjid Al-Akbar.
- **Route signs.** At every province border there is a "Selamat Datang di Provinsi …" board for each direction and a small "Batas Provinsi" sign. Where a toll road starts (after the gate, or after joining it at a junction) a green board reads "Selamat Datang di Jalan Tol <name>".
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
- **Tol Layang MBZ is for passenger cars only.** Only sedans, SUVs and pickups (and police) may use it, as the entry board says: routes for buses, trucks, angkot, ambulances and fire engines never use MBZ, and the traffic on the deck is passenger cars only. How you get on and off it:
  - **Getting on.** About 450 m after JCT Cikunir a two-lane ramp leaves Jakarta–Cikampek on the left, like an exit. Signs and the instruction bar say "lajur paling kiri"; steer left at the gap in the guard rail. The ramp climbs beside the toll road, outside the guard rail, and only once it clears the traffic does it swing over Japek to the deck above the median. Stay on Japek and you simply drive on underneath.
  - **Getting off.** At the far end each direction swings out to the side again and comes down onto Japek's left lane before Karawang Barat. On an MBZ route that you leave at the fork, the route carries on along Japek.
  - **Supports.** The deck stands on one column per pier in Japek's median. Beside Japek the ramps have a single column each; where they cross over it, a bent with columns in the median and outside the road carries them, so no column ever stands in a lane.
  - **The same world from both roads.** Driving Japek or the MBZ you see the same ramps, deck, columns and traffic.
- **Stacked and elevated roads.**
  - Waru–Juanda, Layang MBZ, Becakayu and Cawang–Priok run on viaducts, with piers and the land, buildings and trees below.
  - From Jakarta–Cikampek you see the MBZ ramps beside you and its deck above the median, with its own traffic; from MBZ you see Japek and its traffic below.
  - Becakayu stands over the Kalimalang canal with Jalan Kalimalang on both banks, and Jalan Kalimalang (Jl. KH Noer Ali) is also in the network.
  - Lanes per direction: JORR 1 and all of JORR 2 have 3, Padaleunyi 4, Semarang ABC 3, Waru–Juanda 2, and the Trans-Jawa toll roads 3.
- **U-turns.** Steer all the way round where the road allows it (anywhere on a national road, through a median opening on a toll road) and the trip carries on the other way.
- **Relaxed driving, inspired by slowroads.io.**
  - The trip type "Santai (ala Slow Roads)" starts an endless drive with autopilot, a compact HUD, winding and hilly roads, a long view, light traffic and a late afternoon sun.
  - Settings:
    - Cuaca: clear, cloudy, rain, fog. Rain brings falling streaks, a wet dark road and less grip.
    - Gaya jalan: as the terrain, more winding and hilly, or straighter.
    - Jarak pandang: normal or far.
    - Setir otomatis: lane keeping while you work the pedals. Steering by hand picks the next lane.
    - Suara: engine pitch follows speed and gear, plus wind and rain.
    - Tampilan HUD: normal or compact (every instrument stays, about 20% smaller and lighter); H or the HUD button switches.
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

### Smooth driving

- The world ahead is built a little at a time (at most two road pieces and one interchange per frame, nearest first), so there are no stutters while driving.
- Leaving the toll road for a town is seamless: after the gate on the exit road, a link road curves forward and joins the road to town. There is no teleport, fade or reload.
- Where nothing stops the car you can leave the road: through gaps in the guard rail (around exits, junctions and rest areas) and beside national roads outside towns. On the grass the car slows down, has less grip and bumps along; it counts once as "keluar badan jalan". Once you are outside the rail it stops you from the outside too. Buildings near the road are solid.
- A median opening on a toll road only lets you through for a deliberate U-turn (or in a contraflow on your side), so you cannot drift into oncoming traffic by accident.

### Exit ramps and interchanges
- **Two lanes.** Exit and entry ramps are two lanes wide. The stem to the toll gate has two lanes each way, with five toll booths, and the link road from the gate into town is two lanes.
- **Clear ramp areas.** Nothing is built on the footprint of an interchange: no houses, shophouses or trees on the ramps, the stem or the link road to town. This holds both on the toll road and on the road you join after leaving it.

### Maps
- **Curved roads.** Every road on the mini map and the atlas is drawn as a smooth curve through its places. Extra shape points are added where a road bends between towns, for example the coast roads Lasem–Tuban and Situbondo–Ketapang, Cipularang, and Banjar–Wangon. The route line and your position follow the same curves.
- **Madura.** The island is drawn on the maps with its roads: the Suramadu–Bangkalan–Sampang–Pamekasan–Sumenep road, the north-coast road Bangkalan–Tanjung Bumi–Ketapang–Ambunten–Sumenep, Sumenep–Kalianget and Bangkalan–Kamal.
- **Other players.** In multiplayer the other players are shown with their names on the mini map and on the atlas, which redraws while it is open.
- **Jembatan Suramadu.** The Madura road crosses the strait on a 12 m deck. There is sea on both sides, piers, parapets and lamps, and two cable-stayed pylons with stay cables over the 434 m main span.

### Provincial and regency roads (jalan provinsi / kabupaten)
These roads link regency seats and well-known destinations, using real town coordinates. They are routed like national roads and drawn finer on the maps:
- Cirebon–Sumber–Majalengka–Kadipaten
- Lohbener–Indramayu–Jatibarang
- Bandung–Soreang–Ciwidey
- Jakarta–Depok–Bojonggede–Bogor
- Cikupa–Tigaraksa
- Solo–Karanganyar–Tawangmangu–Sarangan–Magetan, and Magetan–Madiun
- Pekalongan–Kajen
- Magelang–Mungkid–Muntilan–Sleman–Yogyakarta
- Yogyakarta–Bantul–Parangtritis
- Wonosobo–Dieng
- Tulungagung–Trenggalek
- Kediri–Pare–Jombang
- Probolinggo–Sukapura–Bromo (Cemoro Lawang)
- Bangkalan–Kamal

Every village and city street is not included: that is millions of road segments, far more than a browser game can load.

### Road signs
- **Icons.** Every sign carries pictograms on white tiles, as on real signs:
  - toll roads, exits and gates: the road symbol;
  - junctions: a fork;
  - rest areas: fuel, food, prayer room, toilet and minimarket;
  - towns: a building;
  - provinces: a map pin;
  - Suramadu: waves;
  - each facility in a rest area: its own symbol.
- **Typeface.** Sign lettering uses Overpass, the open typeface modelled on Highway Gothic. It is self-hosted in `fonts/` under the SIL Open Font License. A device that has Highway Gothic installed uses that instead.

### Money for driving
Cash is added while the car is moving:
- Rp 30.000 every 1–2 minutes of driving.
- Rp 50.000 every 5 minutes.
- Rp 100.000 every 2 km.

The counters are saved with the wallet.

### Jobs (Kerja, key J)
Pick a job and the vehicle is swapped for the right one on the spot.

| Job | Vehicle | Pay |
|---|---|---|
| Ojek online | motorbike | Rp 9.000 + Rp 2.500/km |
| Antar makanan | motorbike | Rp 10.000 + Rp 2.500/km |
| Sopir taksi | taxi | Rp 7.500 + Rp 6.500/km |
| Sopir bus | bus | Rp 8.000 per boarding passenger |
| Sopir angkot | angkot | Rp 5.000 per boarding passenger |
| Sopir truk ekspedisi | truck | Rp 250.000 + Rp 9.000/km, less damage to the load |

- **Stops.** Stops are marked by the road: a coloured post with people waiting, a bus shelter, a food stall or a pile of crates. Pull over next to the marker and stop to pick up or drop off.
- **Rating.** Each trip is rated with 1–5 stars according to violations and crashes. Five stars earns a Rp 5.000 tip.
- **Motorbikes.** Motorbike jobs never use toll roads: the road ahead is planned again without them.

### Cockpit interior
The cockpit camera now sits in a right-hand-drive interior:
- a dashboard and a steering wheel that turns with the front wheels;
- a live instrument cluster: speed, gear, fuel and time;
- A-pillars, headliner, centre console and the bonnet in the car's paint.

### Body textures (liveries)
Under Modifikasi, choose a pattern for the body in the paint colour and a second colour: Polos, Garis balap, Api, Kamuflase, Batik kawung, Karbon, Gradasi, Kotak balap or Polkadot.

### Tow truck drives by the rules
- **Coming.** It comes in the left lane at the speed limit, keeps its distance and queues behind traffic. It stops and pays at toll gates and stops at red lights. Other traffic sees it and queues behind it too.
- **At your car.** Only there does it pull onto the shoulder, then it reverses slowly up to your car.
- **Towing.** It rejoins the lane only when there is a gap and tows in traffic.
- **Dropping off.** It puts the repaired car down on the shoulder.

### Fixes
- **Toll gates.** You can stop anywhere in the last 9 m before the barrier, as long as nobody is between you and it. Before, it had to be within 2.5 m, so a car stopped at the booth did not pay and was later fined for running the gate. The instruction bar now guides you through the gate.
- **Ramps.** Ramps have posted limits: rest areas and exits 40 km/h, junctions 60 km/h, MBZ 80 km/h. The limit is shown on the HUD, and speeding there is a violation, so nobody arrives at the fuel queue at 110 km/h.

### Performance
- **Grafis setting.** A personal setting with four options: Otomatis, Hemat, Sedang and Tinggi. Hemat starts at the lightest level: no shadows or bloom, lower resolution and a shorter view.
- **Phones and tablets.** At most one road section is built per frame.
- **Shaders.** They are compiled up front, so new objects do not stutter the first time they appear.
- **Mini map.** The island and its roads are cached and not redrawn every half second.

