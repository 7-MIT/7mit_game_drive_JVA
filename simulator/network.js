// Jaringan Jalan Tol Pulau Jawa: data koridor, exit, simpang susun, dan pencarian rute.
// KM dan koordinat diperkirakan dari peta publik. Urutan exit sudah sesuai, tetapi angka KM bisa meleset beberapa km.
// kind: x = exit (gerbang tol di ujung ramp), j = simpang susun (JCT), r = rest area,
//       g = gerbang tol di jalur utama (barrier), t = ujung jalan tol (gerbang tol di jalur utama, tol berakhir)
// Koordinat [lat, lon] yang kosong diisi dengan interpolasi berdasarkan KM.

const C = (id, name, short, lanes, limit, nodes, planned = false) => ({id, name, short, lanes, limit, planned, cls: 't',
  nodes: nodes.map(([name, km, kind, lat, lon]) => ({name, km, kind, lat, lon}))});
// Jalan Nasional (non-tol): every node is a town or junction with a signalised intersection (kind k)
const N = (id, name, short, lanes, limit, nodes) => ({id, name, short, lanes, limit, planned: false, cls: 'n',
  nodes: nodes.map(([name, km, lat, lon]) => ({name, km, kind: 'k', lat, lon}))});

// Jalan provinsi / kabupaten: routed like national roads, drawn finer on the maps
const PV = (...a) => ({...N(...a), prov: true});

export const CORRIDORS = [
  C('tm', 'Tol Jakarta–Tangerang–Merak', 'Tangerang–Merak', 3, 100, [
    ['JCT Tomang', 0, 'j', -6.178, 106.795], ['JCT Kebon Jeruk', 6, 'j', -6.193, 106.763], ['Meruya', 8, 'x', -6.196, 106.738],
    ['GT Karang Tengah', 11, 'g', -6.205, 106.712], ['JCT Kunciran', 15, 'j', -6.205, 106.675], ['Tangerang', 18, 'x', -6.190, 106.640], ['Karawaci', 21, 'x', -6.212, 106.607],
    ['Bitung', 25, 'x', -6.222, 106.560], ['Cikupa', 31, 'x', -6.222, 106.510], ['GT Cikupa', 32, 'g', -6.220, 106.500],
    ['Balaraja Timur', 39, 'x', -6.208, 106.462], ['Balaraja Barat', 43, 'x', -6.195, 106.420], ['Rest Area KM 45', 45, 'r'],
    ['Cikande', 49, 'x', -6.172, 106.350], ['Ciujung', 57, 'x', -6.150, 106.290], ['Rest Area KM 66', 66, 'r'],
    ['Serang Timur', 68, 'x', -6.128, 106.182], ['Serang Barat', 75, 'x', -6.100, 106.122], ['Cilegon Timur', 87, 'x', -6.020, 106.062],
    ['Cilegon Barat', 92, 'x', -5.980, 106.030], ['Merak', 98, 't', -5.930, 106.000]]),
  C('dk', 'Tol Dalam Kota Jakarta', 'Dalam Kota', 3, 80, [
    ['JCT Cawang', 0, 'j', -6.245, 106.872], ['Tebet', 2, 'x', -6.236, 106.850], ['Kuningan', 4, 'x', -6.228, 106.832],
    ['Semanggi', 6, 'x', -6.220, 106.812], ['Slipi', 9, 'x', -6.200, 106.800], ['JCT Tomang', 11, 'j'],
    ['Grogol', 13, 'x', -6.165, 106.790], ['Jelambar', 15, 'x', -6.145, 106.788], ['JCT Pluit', 18, 'j', -6.120, 106.790]]),
  C('sed', 'Tol Prof. Sedyatmo', 'Sedyatmo', 3, 80, [
    ['JCT Pluit', 0, 'j'], ['Kapuk', 4, 'x', -6.115, 106.750], ['Bandara Soekarno-Hatta', 13, 't', -6.110, 106.660]]),
  C('japek', 'Tol Jakarta–Cikampek', 'Jakarta–Cikampek', 5, 100, [
    ['JCT Cawang', 0, 'j'], ['Halim', 3, 'x', -6.250, 106.890], ['Pondok Gede Barat', 6, 'x', -6.258, 106.920],
    ['Rest Area KM 6', 6.6, 'r'], ['Jatibening', 8, 'x', -6.258, 106.940], ['JCT Cikunir', 10, 'j', -6.256, 106.958],
    ['Bekasi Barat', 12, 'x', -6.248, 106.990], ['Bekasi Timur', 16, 'x', -6.255, 107.020], ['Rest Area KM 19', 19, 'r'],
    ['Tambun', 22, 'x', -6.262, 107.060], ['JCT Cibitung', 25, 'j', -6.270, 107.090], ['Cibitung', 26, 'x', -6.275, 107.100],
    ['Cikarang Barat', 31, 'x', -6.290, 107.140], ['Cikarang Timur', 37, 'x', -6.310, 107.190], ['Rest Area KM 39', 39, 'r'],
    ['Karawang Barat', 46, 'x', -6.330, 107.270], ['Karawang Timur', 54, 'x', -6.350, 107.340], ['Rest Area KM 57', 57, 'r'],
    ['JCT Dawuan', 66, 'j', -6.390, 107.430], ['Cikampek', 71, 'x', -6.410, 107.460], ['JCT Cikopo', 73, 'j', -6.430, 107.490]]),
  C('jorr', 'Tol Lingkar Luar Jakarta (JORR)', 'JORR', 3, 80, [
    ['Penjaringan', 0, 't', -6.115, 106.765], ['Kembangan', 7, 'x', -6.180, 106.742], ['JCT Kebon Jeruk', 9, 'j'],
    ['Joglo', 12, 'x', -6.215, 106.745], ['Ciledug', 14, 'x', -6.235, 106.755], ['Veteran', 16, 'x', -6.252, 106.765],
    ['JCT Ulujami', 18, 'j', -6.262, 106.772], ['Pondok Pinang', 21, 'x', -6.280, 106.782], ['Fatmawati', 24, 'x', -6.290, 106.797], ['JCT Antasari', 25, 'j', -6.292, 106.807],
    ['Ampera', 26, 'x', -6.292, 106.815], ['Pasar Minggu', 28, 'x', -6.296, 106.840], ['JCT Taman Mini', 33, 'j', -6.300, 106.880],
    ['Jatiwarna', 38, 'x', -6.310, 106.920], ['JCT Cikunir', 43, 'j'], ['Kalimalang', 45, 'x', -6.245, 106.955],
    ['Cakung', 51, 'x', -6.190, 106.955], ['Rorotan', 56, 'x', -6.145, 106.950], ['JCT Cilincing', 60, 'j', -6.120, 106.950]]),
  C('wiyoto', 'Tol Ir. Wiyoto Wiyono (Cawang–Tanjung Priok)', 'Cawang–Priok', 3, 80, [
    ['JCT Cawang', 0, 'j'], ['Cempaka Putih', 7, 'x', -6.180, 106.872], ['Sunter', 10, 'x', -6.148, 106.872], ['JCT Tanjung Priok', 14, 'j', -6.118, 106.880]]),
  C('atp', 'Tol Akses Tanjung Priok', 'Akses Tj. Priok', 3, 80, [
    ['JCT Tanjung Priok', 0, 'j'], ['Pelabuhan Tanjung Priok', 2, 't', -6.105, 106.885], ['Koja', 5, 'x', -6.117, 106.910], ['JCT Cilincing', 11.4, 'j']]),
  C('jjc', 'Tol Cibitung–Cilincing (JORR 2)', 'Cibitung–Cilincing', 3, 80, [
    ['JCT Cibitung', 0, 'j'], ['Telaga Asih', 4, 'x', -6.240, 107.080], ['Gabus', 15, 'x', -6.180, 107.040],
    ['Tarumajaya', 25, 'x', -6.130, 107.010], ['JCT Cilincing', 34, 'j']]),
  C('jag', 'Tol Jagorawi', 'Jagorawi', 4, 100, [
    ['JCT Cawang', 0, 'j'], ['JCT Taman Mini', 5, 'j'], ['GT Cibubur', 9, 'g', -6.355, 106.885], ['Cibubur', 11, 'x', -6.370, 106.890],
    ['JCT Cimanggis', 14, 'j', -6.392, 106.886], ['Cimanggis', 15, 'x', -6.400, 106.885], ['Gunung Putri', 21, 'x', -6.450, 106.880], ['Citeureup', 26, 'x', -6.490, 106.870],
    ['Sentul', 29, 'x', -6.530, 106.860], ['Rest Area KM 30', 30, 'r'], ['Sentul Selatan', 35, 'x', -6.565, 106.858],
    ['Bogor', 43, 'x', -6.600, 106.820], ['JCT Ciawi', 47, 'j', -6.660, 106.845]]),
  C('bocimi', 'Tol Bogor–Ciawi–Sukabumi', 'Bocimi', 2, 80, [
    ['JCT Ciawi', 0, 'j'], ['Cigombong', 15, 'x', -6.750, 106.800], ['Cibadak', 26, 't', -6.890, 106.780]]),
  C('serpong', 'Tol Ulujami–Serpong', 'Ulujami–Serpong', 3, 80, [
    ['JCT Ulujami', 0, 'j'], ['Bintaro', 3, 'x', -6.272, 106.740], ['Pondok Aren', 6, 'x', -6.272, 106.710], ['Serpong', 11, 'j', -6.300, 106.670]]),
  C('cipularang', 'Tol Cipularang', 'Cipularang', 2, 100, [
    ['JCT Dawuan', 66, 'j'], ['GT Kalihurip Utama', 67, 'g', -6.400, 107.440], ['Sadang', 76, 'x', -6.500, 107.440],
    ['Jatiluhur', 84, 'x', -6.560, 107.400], ['Rest Area KM 88', 88, 'r'], ['Rest Area KM 97', 97, 'r'], ['JCT Padalarang', 121, 'j', -6.845, 107.480]]),
  C('padaleunyi', 'Tol Padaleunyi', 'Padaleunyi', 4, 80, [
    ['JCT Padalarang', 121, 'j'], ['Padalarang', 122, 'x', -6.850, 107.492], ['Baros', 125, 'x', -6.890, 107.535],
    ['Pasteur', 128, 'x', -6.890, 107.575], ['JCT Pasir Koja', 131, 'j', -6.925, 107.578], ['Kopo', 134, 'x', -6.950, 107.575],
    ['Mohammad Toha', 138, 'x', -6.960, 107.610], ['Buahbatu', 142, 'x', -6.960, 107.645], ['Rest Area KM 147', 147, 'r'],
    ['JCT Cileunyi', 152, 'j', -6.940, 107.745], ['Cileunyi', 153, 't', -6.938, 107.752]]),
  C('soroja', 'Tol Soreang–Pasir Koja', 'Soroja', 2, 80, [
    ['JCT Pasir Koja', 0, 'j'], ['Margaasih', 4, 'x', -6.950, 107.550], ['Kutawaringin', 7, 'x', -6.990, 107.530], ['Soreang', 10, 't', -7.030, 107.520]]),
  C('cisumdawu', 'Tol Cileunyi–Sumedang–Dawuan', 'Cisumdawu', 2, 80, [
    ['JCT Cileunyi', 0, 'j'], ['Pamulihan', 12, 'x', -6.880, 107.830], ['Sumedang', 20, 'x', -6.840, 107.920],
    ['Cimalaka', 29, 'x', -6.800, 107.960], ['Ujung Jaya', 50, 'x', -6.730, 108.070], ['JCT Kertajati', 61, 'j', -6.675, 108.170]]),
  C('cipali', 'Tol Cikopo–Palimanan (Cipali)', 'Cipali', 3, 100, [
    ['JCT Cikopo', 73, 'j'], ['Rest Area KM 86', 86, 'r'], ['Kalijati', 98, 'x', -6.530, 107.680], ['Subang', 102, 'x', -6.530, 107.750],
    ['Rest Area KM 102', 103, 'r'], ['Rest Area KM 130', 130, 'r'], ['Cikedung', 136, 'x', -6.520, 108.080],
    ['JCT Kertajati', 149, 'j'], ['Sumberjaya', 160, 'x', -6.660, 108.300], ['Rest Area KM 166', 166, 'r'],
    ['GT Palimanan', 188, 'g', -6.695, 108.430]]),
  C('palikanci', 'Tol Palimanan–Kanci', 'Palikanci', 3, 100, [
    ['GT Palimanan', 188, 'g'], ['Plumbon', 194, 'x', -6.700, 108.470], ['Kedawung', 199, 'x', -6.712, 108.520],
    ['Ciperna', 205, 'x', -6.760, 108.550], ['Kanci', 214, 'x', -6.800, 108.620]]),
  C('kapek', 'Tol Kanci–Pejagan', 'Kanci–Pejagan', 3, 100, [
    ['Kanci', 214, 'x'], ['Rest Area KM 228', 228, 'r'], ['Pejagan', 249, 'x', -6.880, 108.860]]),
  C('pejpem', 'Tol Pejagan–Pemalang', 'Pejagan–Pemalang', 3, 100, [
    ['Pejagan', 249, 'x'], ['Brebes Barat', 252, 'x', -6.880, 108.990], ['Brebes Timur', 258, 'x', -6.890, 109.050],
    ['Rest Area KM 260', 260, 'r'], ['Tegal', 265, 'x', -6.920, 109.120], ['Adiwerna', 271, 'x', -6.935, 109.140],
    ['Pemalang', 306, 'x', -6.930, 109.380]]),
  C('pemba', 'Tol Pemalang–Batang', 'Pemalang–Batang', 3, 100, [
    ['Pemalang', 306, 'x'], ['Rest Area KM 319', 319, 'r'], ['Pekalongan', 330, 'x', -6.940, 109.660], ['Batang', 345, 'x', -6.940, 109.750]]),
  C('batsem', 'Tol Batang–Semarang', 'Batang–Semarang', 3, 100, [
    ['Batang', 345, 'x'], ['Rest Area KM 360', 360, 'r'], ['Weleri', 373, 'x', -6.980, 110.060], ['Kendal', 390, 'x', -6.980, 110.200],
    ['Rest Area KM 391', 391, 'r'], ['Kaliwungu', 403, 'x', -6.982, 110.270], ['GT Kalikangkung', 414, 'g', -6.990, 110.330],
    ['Krapyak', 420, 'x', -7.000, 110.370]]),
  C('semabc', 'Tol Semarang Seksi A–B–C', 'Semarang ABC', 3, 80, [
    ['Krapyak', 420, 'x'], ['Manyaran', 422, 'x', -7.003, 110.390], ['JCT Jatingaleh', 426, 'j', -7.030, 110.420],
    ['Tembalang', 429, 'x', -7.050, 110.430], ['GT Banyumanik', 433, 'g', -7.070, 110.420]]),
  C('semdem', 'Tol Semarang–Demak', 'Semarang–Demak', 2, 80, [
    ['JCT Jatingaleh', 0, 'j'], ['Kaligawe', 8, 'x', -6.960, 110.450], ['Sayung', 16, 'x', -6.930, 110.520], ['Demak', 27, 't', -6.900, 110.630]]),
  C('semsol', 'Tol Semarang–Solo', 'Semarang–Solo', 3, 100, [
    ['GT Banyumanik', 433, 'g'], ['Ungaran', 440, 'x', -7.140, 110.410], ['Bawen', 450, 'x', -7.240, 110.430],
    ['Rest Area KM 456', 456, 'r'], ['Salatiga', 467, 'x', -7.330, 110.490], ['Boyolali', 485, 'x', -7.500, 110.620],
    ['Rest Area KM 487', 487, 'r'], ['JCT Kartasura', 495, 'j', -7.530, 110.740], ['Colomadu', 498, 'x', -7.520, 110.760]]),
  C('soljog', 'Tol Solo–Yogyakarta', 'Solo–Jogja', 2, 100, [
    ['JCT Kartasura', 0, 'j'], ['Klaten', 23, 'x', -7.700, 110.580], ['Prambanan', 36, 'x', -7.760, 110.490], ['Purwomartani', 42, 't', -7.760, 110.450]]),
  C('solnga', 'Tol Solo–Ngawi', 'Solo–Ngawi', 3, 100, [
    ['Colomadu', 498, 'x'], ['Ngemplak', 504, 'x', -7.510, 110.810], ['Gondangrejo', 511, 'x', -7.490, 110.860],
    ['Rest Area KM 519', 519, 'r'], ['Sragen', 535, 'x', -7.430, 111.010], ['Sragen Timur', 548, 'x', -7.440, 111.100],
    ['Rest Area KM 575', 573, 'r'], ['Ngawi', 575, 'x', -7.420, 111.400]]),
  C('ngker', 'Tol Ngawi–Kertosono', 'Ngawi–Kertosono', 3, 100, [
    ['Ngawi', 575, 'x'], ['Madiun', 604, 'x', -7.560, 111.580], ['Caruban', 626, 'x', -7.550, 111.660],
    ['Rest Area KM 626', 627, 'r'], ['Nganjuk', 652, 'x', -7.580, 111.900], ['Bandar', 670, 'x', -7.570, 112.100]]),
  C('kermo', 'Tol Kertosono–Mojokerto', 'Kertosono–Mojokerto', 3, 100, [
    ['Bandar', 670, 'x'], ['Jombang', 683, 'x', -7.530, 112.250], ['Rest Area KM 695', 693, 'r'], ['Mojokerto Barat', 695, 'x', -7.470, 112.370]]),
  C('sumo', 'Tol Surabaya–Mojokerto', 'Surabaya–Mojokerto', 3, 100, [
    ['Mojokerto Barat', 695, 'x'], ['Mojokerto Utara', 705, 'x', -7.450, 112.440], ['Krian', 720, 'x', -7.400, 112.580],
    ['Driyorejo', 725, 'x', -7.360, 112.630], ['GT Warugunung', 729, 'g', -7.340, 112.690], ['JCT Waru', 734, 'j', -7.350, 112.730]]),
  C('sugem', 'Tol Surabaya–Gempol', 'Surabaya–Gempol', 3, 100, [
    ['Dupak', 724, 't', -7.240, 112.720], ['Gunungsari', 729, 'x', -7.290, 112.720], ['JCT Waru', 734, 'j'],
    ['Sidoarjo', 745, 'x', -7.450, 112.710], ['Porong', 755, 'x', -7.540, 112.690], ['JCT Gempol', 760, 'j', -7.560, 112.690]]),
  C('juanda', 'Tol Waru–Juanda (jalan layang)', 'Waru–Juanda', 2, 80, [
    ['JCT Waru', 0, 'j'], ['Bandara Juanda', 6, 't', -7.370, 112.780]]),
  C('gempan', 'Tol Gempol–Pandaan–Malang', 'Pandaan–Malang', 2, 100, [
    ['JCT Gempol', 0, 'j'], ['Pandaan', 13, 'x', -7.650, 112.690], ['Purwodadi', 22, 'x', -7.780, 112.720],
    ['Lawang', 29, 'x', -7.830, 112.700], ['Singosari', 36, 'x', -7.890, 112.670], ['Pakis', 42, 'x', -7.950, 112.710], ['Malang', 45, 't', -7.980, 112.690]]),
  C('gempas', 'Tol Gempol–Pasuruan', 'Gempol–Pasuruan', 3, 100, [
    ['JCT Gempol', 760, 'j'], ['Bangil', 768, 'x', -7.590, 112.780], ['Rembang', 774, 'x', -7.620, 112.840],
    ['Pasuruan', 783, 'x', -7.650, 112.900], ['Grati', 794, 'x', -7.700, 113.000]]),
  C('paspro', 'Tol Pasuruan–Probolinggo', 'Pasuruan–Probolinggo', 3, 100, [
    ['Grati', 794, 'x'], ['Rest Area KM 802', 802, 'r'], ['Probolinggo Barat', 812, 'x', -7.750, 113.150], ['Probolinggo Timur', 821, 'x', -7.780, 113.240]]),
  C('probo', 'Tol Probolinggo–Banyuwangi', 'Probowangi', 3, 100, [
    ['Probolinggo Timur', 821, 'x'], ['Gending', 833, 'x', -7.790, 113.310], ['Kraksaan', 844, 'x', -7.760, 113.410],
    ['Paiton', 852, 'x', -7.720, 113.510], ['Besuki', 870, 'x', -7.730, 113.700]]),
  C('probo2', 'Tol Probolinggo–Banyuwangi (rencana)', 'Probowangi (rencana)', 2, 100, [
    ['Besuki', 870, 'x'], ['Situbondo', 900, 'x', -7.700, 114.000], ['Asembagus', 925, 'x', -7.750, 114.220],
    ['Ketapang', 960, 't', -8.140, 114.400]], true),

  C('kunser', 'Tol Kunciran–Serpong (JORR 2)', 'Kunciran–Serpong', 3, 80, [
    ['JCT Kunciran', 0, 'j'], ['Parigi', 5, 'x', -6.255, 106.690], ['Pondok Kacang', 8, 'x', -6.275, 106.685], ['Serpong', 11, 'j']]),
  C('serbal', 'Tol Serpong–Balaraja', 'Serpong–Balaraja', 2, 80, [
    ['Serpong', 0, 'j'], ['CBD BSD', 3, 'x', -6.302, 106.645], ['Legok', 8, 't', -6.300, 106.600]]),
  C('kunban', 'Tol Cengkareng–Kunciran (JORR 2)', 'Cengkareng–Kunciran', 3, 80, [
    ['JCT Kunciran', 0, 'j'], ['Benda', 4, 'x', -6.185, 106.672], ['Batuceper', 8, 'x', -6.165, 106.670], ['Bandara Soekarno-Hatta', 14.2, 't']]),
  // JORR 2 Serpong–Cinere: seksi 1 Serpong–Pamulang (2021), seksi 2 Pamulang–Cinere (Des 2023), 10,14 km, tersambung ke Cijago
  C('sercin', 'Tol Serpong–Cinere (JORR 2)', 'Serpong–Cinere', 3, 80, [
    ['Serpong', 0, 'j'], ['Pamulang', 6.5, 'x', -6.338, 106.727], ['Cinere', 9.2, 'x', -6.343, 106.770], ['JCT Cinere', 10.1, 'j', -6.348, 106.779]]),
  C('desari', 'Tol Depok–Antasari (Desari)', 'Desari', 2, 80, [
    ['JCT Antasari', 0, 'j'], ['Cilandak', 3, 'x', -6.310, 106.805], ['Brigif', 7, 'x', -6.340, 106.808], ['JCT Krukut', 12, 'j', -6.362, 106.785], ['Sawangan', 21, 't', -6.400, 106.760]]),
  C('cijago', 'Tol Cinere–Jagorawi (Cijago, JORR 2)', 'Cijago', 3, 80, [
    ['JCT Cimanggis', 0, 'j'], ['Jalan Raya Bogor', 3, 'x', -6.390, 106.862], ['Margonda', 7, 'x', -6.380, 106.832], ['Kukusan', 10, 'x', -6.370, 106.810],
    ['JCT Krukut', 12, 'j'], ['Limo', 13.6, 'x', -6.358, 106.781], ['JCT Cinere', 14.9, 'j']]),
  C('cimcib', 'Tol Cimanggis–Cibitung (JORR 2)', 'Cimanggis–Cibitung', 3, 80, [
    ['JCT Cimanggis', 0, 'j'], ['Cikeas', 8, 'x', -6.400, 106.935], ['Narogong', 16, 'x', -6.380, 107.000], ['Setu', 21, 'x', -6.340, 107.040], ['JCT Cibitung', 26, 'j']]),
  C('becakayu', 'Tol Bekasi–Cawang–Kampung Melayu (Becakayu)', 'Becakayu', 2, 60, [
    ['Kampung Melayu', 0, 't', -6.225, 106.860], ['Cipinang', 4, 'x', -6.240, 106.890], ['Jakasampurna', 9, 'x', -6.250, 106.965], ['Bekasi Kota', 13, 't', -6.238, 107.000]]),
  C('mbz', 'Tol Layang Mohammed bin Zayed (Japek II)', 'Layang MBZ', 2, 80, [
    ['JCT Cikunir', 10, 'j'], ['Karawang Barat', 46, 'x']]),
  C('borr', 'Tol Lingkar Luar Bogor (BORR)', 'BORR', 2, 80, [
    ['Sentul Selatan', 0, 'x'], ['Kedung Halang', 4, 'x', -6.560, 106.810], ['Kayu Manis', 8, 'x', -6.550, 106.780], ['Simpang Yasmin', 11, 't', -6.560, 106.760]]),
  C('serpan', 'Tol Serang–Panimbang', 'Serang–Panimbang', 2, 100, [
    ['Serang Timur', 0, 'x'], ['Walantaka', 6, 'x', -6.150, 106.220], ['Rangkasbitung', 26, 't', -6.360, 106.240]]),
  C('surges', 'Tol Surabaya–Gresik', 'Surabaya–Gresik', 2, 80, [
    ['Dupak', 0, 't'], ['Tandes', 4, 'x', -7.250, 112.680], ['Romokalisari', 10, 'x', -7.200, 112.660], ['Manyar', 18, 'j', -7.120, 112.600]]),
  C('klbm', 'Tol Krian–Legundi–Bunder–Manyar', 'KLBM', 2, 100, [
    ['Krian', 0, 'x'], ['Legundi', 12, 'x', -7.340, 112.550], ['Bunder', 22, 'x', -7.200, 112.580], ['Manyar', 38, 'j']]),

  // ---------------- Jalan Nasional (arteri) ----------------
  N('pantura1', 'Jalan Nasional Pantura (Merak–Jakarta)', 'Pantura Merak–Jakarta', 2, 80, [
    ['Merak', 0, -5.935, 106.005], ['Cilegon', 12, -6.010, 106.050], ['Serang', 26, -6.115, 106.150], ['Kragilan', 38, -6.150, 106.300],
    ['Balaraja', 52, -6.200, 106.450], ['Cikupa', 60, -6.225, 106.515], ['Tangerang', 75, -6.178, 106.630], ['Jakarta', 92, -6.175, 106.827]]),
  N('pantura2', 'Jalan Nasional Pantura (Jakarta–Cirebon)', 'Pantura Jakarta–Cirebon', 2, 80, [
    ['Jakarta', 0], ['Bekasi', 22, -6.238, 107.000], ['Cikarang', 40, -6.262, 107.150], ['Karawang', 58, -6.305, 107.300],
    ['Cikampek', 78, -6.410, 107.455], ['Pamanukan', 120, -6.285, 107.810], ['Lohbener', 170, -6.400, 108.280], ['Jatibarang', 185, -6.475, 108.310],
    ['Cirebon', 225, -6.710, 108.555]]),
  N('pantura3', 'Jalan Nasional Pantura (Cirebon–Semarang)', 'Pantura Cirebon–Semarang', 2, 80, [
    ['Cirebon', 0], ['Losari', 30, -6.830, 108.820], ['Brebes', 55, -6.870, 109.040], ['Tegal', 64, -6.870, 109.140],
    ['Pemalang', 92, -6.890, 109.380], ['Pekalongan', 125, -6.890, 109.675], ['Batang', 133, -6.910, 109.730], ['Weleri', 165, -6.970, 110.070],
    ['Kendal', 182, -6.920, 110.200], ['Semarang', 210, -6.980, 110.420]]),
  N('pantura4', 'Jalan Nasional Pantura (Semarang–Surabaya)', 'Pantura Semarang–Surabaya', 2, 80, [
    ['Semarang', 0], ['Demak', 26, -6.890, 110.640], ['Kudus', 51, -6.805, 110.840], ['Pati', 75, -6.750, 111.040],
    ['Rembang', 110, -6.705, 111.340], ['Lasem', 122, -6.690, 111.440], ['Tuban', 205, -6.900, 112.050], ['Lamongan', 270, -7.120, 112.410],
    ['Gresik', 295, -7.160, 112.650], ['Surabaya', 312, -7.260, 112.750]]),
  N('pantura5', 'Jalan Nasional Surabaya–Banyuwangi', 'Surabaya–Banyuwangi', 2, 80, [
    ['Surabaya', 0], ['Sidoarjo', 25, -7.450, 112.720], ['Porong', 38, -7.540, 112.695], ['Gempol', 44, -7.560, 112.700],
    ['Bangil', 55, -7.600, 112.780], ['Pasuruan', 65, -7.645, 112.905], ['Probolinggo', 100, -7.755, 113.215], ['Kraksaan', 125, -7.760, 113.410],
    ['Besuki', 160, -7.735, 113.700], ['Situbondo', 192, -7.710, 114.010], ['Ketapang', 290, -8.140, 114.400]]),
  // Jalan Raya Jakarta–Bogor lewat barat: Tentara Pelajar – Kebayoran Lama – Ciputat – Pondok Cabe – Sawangan (Depok) – Parung – Kemang – Bogor
  N('jkbg', 'Jalan Raya Jakarta–Bogor (Jalan Nasional 6 Jawa: Tentara Pelajar–Ciputat–Parung)', 'Jkt–Bogor via Parung', 2, 60, [
    ['Jakarta', 0], ['Tentara Pelajar', 5, -6.205, 106.800], ['Kebayoran Lama', 9, -6.243, 106.778], ['Pondok Pinang', 12.5, -6.272, 106.776],
    ['Ciputat', 20, -6.312, 106.745], ['Pondok Cabe', 24, -6.338, 106.758], ['Sawangan', 30, -6.398, 106.758], ['Parung', 37, -6.428, 106.727],
    ['Kemang', 45, -6.497, 106.745], ['Bogor', 56, -6.597, 106.800]]),
  // Jalur Pantai Selatan (Pansela): Banten – Jawa Barat – Jawa Tengah – DIY – Jawa Timur
  N('pansela1', 'Jalan Nasional Pantai Selatan (Labuan–Bayah–Palabuhanratu)', 'Pansela Banten', 1, 60, [
    ['Labuan', 0], ['Panimbang', 22, -6.530, 105.700], ['Malingping', 70, -6.770, 106.020], ['Bayah', 100, -6.930, 106.230], ['Cisolok', 125, -6.950, 106.450], ['Palabuhanratu', 135]]),
  N('pansela2', 'Jalan Nasional Pantai Selatan (Palabuhanratu–Pangandaran)', 'Pansela Jawa Barat', 1, 60, [
    ['Palabuhanratu', 0], ['Surade', 55, -7.330, 106.550], ['Sindangbarang', 125, -7.450, 107.130], ['Cidaun', 150, -7.470, 107.370], ['Rancabuaya', 175, -7.480, 107.550],
    ['Pameungpeuk', 200, -7.650, 107.720], ['Cipatujah', 245, -7.750, 108.030], ['Pangandaran', 315, -7.690, 108.650]]),
  N('pansela3', 'Jalan Nasional Pantai Selatan (Pangandaran–Cilacap–Kebumen)', 'Pansela Pangandaran–Kebumen', 1, 60, [
    ['Pangandaran', 0], ['Kalipucang', 15, -7.650, 108.760], ['Cilacap', 70, -7.730, 109.010], ['Kroya', 95, -7.630, 109.250], ['Kebumen', 140]]),
  N('pansela4', 'Jalan Nasional Yogyakarta–Wonosari–Pacitan', 'Yogya–Wonosari–Pacitan', 1, 60, [
    ['Yogyakarta', 0], ['Piyungan', 15, -7.840, 110.470], ['Wonosari', 40, -7.960, 110.600], ['Pracimantoro', 75, -8.060, 110.800], ['Pacitan', 115]]),
  N('pansela5', 'Jalan Lintas Selatan Jawa Timur (Pacitan–Prigi–Tulungagung)', 'JLS Pacitan–Tulungagung', 1, 60, [
    ['Pacitan', 0], ['Panggul', 45, -8.280, 111.450], ['Prigi', 80, -8.290, 111.730], ['Tulungagung', 120]]),
  N('malsel', 'Jalan Nasional Malang–Turen–Dampit–Lumajang', 'Malang–Lumajang', 1, 60, [
    ['Malang', 0], ['Turen', 25, -8.170, 112.700], ['Dampit', 35, -8.210, 112.750], ['Lumajang', 90]]),
  N('lumjem', 'Jalan Nasional Lumajang–Jember', 'Lumajang–Jember', 1, 60, [
    ['Lumajang', 0], ['Jatiroto', 25, -8.120, 113.360], ['Jember', 50]]),
  N('banjar', 'Jalan Nasional Banjar–Pangandaran', 'Banjar–Pangandaran', 1, 60, [
    ['Banjar', 0], ['Banjarsari', 18, -7.500, 108.630], ['Pangandaran', 45]]),
  N('purwakarta', 'Jalan Nasional Cikampek–Purwakarta–Padalarang', 'Cikampek–Purwakarta–Padalarang', 1, 60, [
    ['Cikampek', 0], ['Purwakarta', 18, -6.550, 107.440], ['Plered', 30, -6.640, 107.390], ['Padalarang', 60]]),
  N('madura', 'Jalan Nasional Suramadu–Bangkalan–Sampang–Pamekasan–Sumenep (Madura)', 'Suramadu–Sumenep', 1, 60, [
    ['Surabaya', 0], ['Bangkalan', 20, -7.050, 112.740], ['Sampang', 75, -7.190, 113.240], ['Pamekasan', 105, -7.160, 113.480], ['Sumenep', 150, -7.010, 113.860]]),
  N('maduraut', 'Jalan Nasional Bangkalan–Tanjung Bumi–Ketapang–Ambunten–Sumenep (Pantura Madura)', 'Pantura Madura', 1, 60, [
    ['Bangkalan', 0], ['Arosbaya', 15, -6.955, 112.855], ['Tanjung Bumi', 45, -6.905, 113.085], ['Ketapang Sampang', 68, -6.895, 113.285],
    ['Pasongsongan', 100, -6.925, 113.615], ['Ambunten', 112, -6.895, 113.735], ['Sumenep', 140]]),
  N('kalianget', 'Jalan Nasional Sumenep–Kalianget', 'Sumenep–Kalianget', 1, 50, [['Sumenep', 0], ['Kalianget', 10, -7.055, 113.935]]),
  // ---- jalan provinsi & kabupaten (ibu kota kabupaten dan tujuan wisata, koordinat asli) ----
  PV('p-majalengka', 'Jalan Provinsi Cirebon–Sumber–Majalengka–Kadipaten', 'Cirebon–Majalengka', 1, 50, [
    ['Cirebon', 0], ['Sumber (Cirebon)', 9, -6.760, 108.480], ['Majalengka', 45, -6.836, 108.228], ['Kadipaten', 57]]),
  PV('p-indramayu', 'Jalan Provinsi Lohbener–Indramayu–Jatibarang', 'Lohbener–Indramayu', 1, 50, [
    ['Lohbener', 0], ['Indramayu', 10, -6.327, 108.322], ['Jatibarang', 28]]),
  PV('p-soreang', 'Jalan Provinsi Bandung–Soreang–Ciwidey', 'Bandung–Ciwidey', 1, 50, [
    ['Bandung', 0], ['Soreang', 24, -7.030, 107.519], ['Ciwidey', 40, -7.100, 107.440]]),
  PV('p-depok', 'Jalan Margonda Raya–Jalan Raya Bogor (Jakarta–Depok–Bojonggede–Bogor)', 'Jakarta–Depok–Bogor', 2, 50, [
    ['Jakarta', 0], ['Depok', 22, -6.402, 106.818], ['Bojonggede', 35, -6.490, 106.800], ['Bogor', 50]]),
  PV('p-tigaraksa', 'Jalan Provinsi Cikupa–Tigaraksa', 'Cikupa–Tigaraksa', 1, 50, [['Cikupa', 0], ['Tigaraksa', 9, -6.267, 106.473]]),
  PV('p-tawangmangu', 'Jalan Provinsi Solo–Karanganyar–Tawangmangu–Sarangan–Magetan', 'Solo–Tawangmangu–Magetan', 1, 40, [
    ['Solo', 0], ['Karanganyar', 14, -7.597, 110.950], ['Tawangmangu', 40, -7.665, 111.130], ['Sarangan', 52, -7.676, 111.218], ['Magetan', 66, -7.650, 111.330]]),
  PV('p-magetan', 'Jalan Provinsi Magetan–Madiun', 'Magetan–Madiun', 1, 50, [['Magetan', 0], ['Madiun', 22]]),
  PV('p-kajen', 'Jalan Kabupaten Pekalongan–Kajen', 'Pekalongan–Kajen', 1, 50, [['Pekalongan', 0], ['Kajen', 25, -7.030, 109.590]]),
  PV('p-mungkid', 'Jalan Provinsi Magelang–Mungkid–Muntilan–Sleman–Yogyakarta', 'Magelang–Sleman–Yogyakarta', 1, 50, [
    ['Magelang', 0], ['Mungkid', 10, -7.555, 110.270], ['Muntilan', 15, -7.580, 110.290], ['Sleman', 32, -7.715, 110.355], ['Yogyakarta', 45]]),
  PV('p-bantul', 'Jalan Parangtritis (Yogyakarta–Bantul–Parangtritis)', 'Yogyakarta–Parangtritis', 1, 50, [
    ['Yogyakarta', 0], ['Bantul', 12, -7.888, 110.330], ['Parangtritis', 28, -8.020, 110.330]]),
  PV('p-dieng', 'Jalan Provinsi Wonosobo–Dieng', 'Wonosobo–Dieng', 1, 40, [['Wonosobo', 0], ['Dieng', 26, -7.210, 109.910]]),
  PV('p-trenggalek', 'Jalan Provinsi Tulungagung–Trenggalek', 'Tulungagung–Trenggalek', 1, 50, [['Tulungagung', 0], ['Trenggalek', 30, -8.050, 111.710]]),
  PV('p-pare', 'Jalan Provinsi Kediri–Pare–Jombang', 'Kediri–Pare–Jombang', 1, 50, [['Kediri', 0], ['Pare', 25, -7.765, 112.195], ['Jombang', 40]]),
  PV('p-bromo', 'Jalan Provinsi Probolinggo–Sukapura–Bromo (Cemoro Lawang)', 'Probolinggo–Bromo', 1, 40, [
    ['Probolinggo', 0], ['Sukapura', 28, -7.880, 113.080], ['Cemoro Lawang', 45, -7.930, 112.955]]),
  PV('p-kamal', 'Jalan Provinsi Bangkalan–Kamal', 'Bangkalan–Kamal', 1, 50, [['Bangkalan', 0], ['Kamal', 18, -7.160, 112.720]]),
  N('jasinga', 'Jalan Nasional Bogor–Leuwiliang–Jasinga–Rangkasbitung–Pandeglang', 'Bogor–Rangkasbitung', 1, 60, [
    ['Bogor', 0], ['Dramaga', 10, -6.560, 106.730], ['Leuwiliang', 22, -6.570, 106.630], ['Jasinga', 45, -6.470, 106.470], ['Rangkasbitung', 80, -6.360, 106.250], ['Pandeglang', 105]]),
  N('sindang', 'Jalan Nasional Cianjur–Sukanagara–Sindangbarang', 'Cianjur–Sindangbarang', 1, 60, [
    ['Cianjur', 0], ['Sukanagara', 45, -7.100, 107.130], ['Sindangbarang', 105]]),
  N('gemolong', 'Jalan Nasional Solo–Gemolong–Purwodadi', 'Solo–Purwodadi', 1, 60, [
    ['Solo', 0], ['Gemolong', 30, -7.400, 110.830], ['Purwodadi', 65]]),
  N('jepara', 'Jalan Nasional Kudus–Jepara', 'Kudus–Jepara', 1, 60, [
    ['Kudus', 0], ['Jepara', 35, -6.590, 110.670]]),
  N('cilacap', 'Jalan Nasional Purwokerto–Cilacap', 'Purwokerto–Cilacap', 1, 60, [
    ['Purwokerto', 0], ['Rawalo', 20, -7.550, 109.110], ['Cilacap', 50]]),
  // Jalan Kalimalang (Jl. KH Noer Ali) along the Kalimalang canal, under the Becakayu elevated toll road
  N('kalimalang', 'Jalan Kalimalang (Jl. KH Noer Ali)', 'Kalimalang', 2, 50, [
    ['Jakarta', 0], ['Cawang', 6, -6.245, 106.870], ['Kalimalang', 12, -6.247, 106.925], ['Pondok Kelapa', 15, -6.243, 106.940], ['Bekasi', 22]]),
  N('puncak', 'Jalan Nasional Jakarta–Bogor–Puncak–Bandung', 'Jakarta–Puncak–Bandung', 1, 60, [
    ['Jakarta', 0], ['Cibinong', 35, -6.480, 106.850], ['Bogor', 50, -6.597, 106.800], ['Ciawi', 57, -6.650, 106.845],
    ['Puncak', 80, -6.700, 107.000], ['Cianjur', 105, -6.820, 107.140], ['Padalarang', 150, -6.843, 107.495], ['Cimahi', 155, -6.872, 107.540],
    ['Bandung', 165, -6.917, 107.610]]),
  N('sukabumi', 'Jalan Nasional Ciawi–Sukabumi–Cianjur', 'Ciawi–Sukabumi', 1, 60, [
    ['Ciawi', 0], ['Cibadak', 30, -6.895, 106.780], ['Sukabumi', 50, -6.920, 106.930], ['Cianjur', 85]]),
  N('sumedang', 'Jalan Nasional Bandung–Sumedang–Cirebon', 'Bandung–Sumedang–Cirebon', 1, 60, [
    ['Bandung', 0], ['Cileunyi', 20, -6.940, 107.750], ['Sumedang', 45, -6.858, 107.920], ['Kadipaten', 80, -6.770, 108.170],
    ['Palimanan', 110, -6.700, 108.425], ['Cirebon', 128]]),
  N('selatan1', 'Jalan Nasional Lintas Selatan (Bandung–Yogyakarta)', 'Lintas Selatan', 1, 60, [
    ['Cileunyi', 0], ['Nagreg', 18, -7.030, 107.920], ['Malangbong', 50, -7.060, 108.080], ['Tasikmalaya', 85, -7.330, 108.220],
    ['Ciamis', 100, -7.330, 108.350], ['Banjar', 120, -7.370, 108.540], ['Wangon', 185, -7.520, 109.050], ['Kebumen', 235, -7.670, 109.650],
    ['Purworejo', 275, -7.710, 110.010], ['Wates', 300, -7.860, 110.160], ['Yogyakarta', 325, -7.795, 110.370]]),
  N('tegal', 'Jalan Nasional Tegal–Purwokerto–Wangon', 'Tegal–Purwokerto', 1, 60, [
    ['Tegal', 0], ['Slawi', 14, -6.980, 109.140], ['Bumiayu', 55, -7.250, 109.000], ['Purwokerto', 95, -7.425, 109.240], ['Wangon', 117]]),
  N('jogsolo', 'Jalan Nasional Yogyakarta–Solo–Surabaya', 'Yogya–Solo–Surabaya', 2, 80, [
    ['Yogyakarta', 0], ['Prambanan', 17, -7.752, 110.490], ['Klaten', 30, -7.705, 110.605], ['Kartasura', 55, -7.555, 110.740],
    ['Solo', 62, -7.570, 110.825], ['Sragen', 92, -7.430, 111.020], ['Ngawi', 140, -7.405, 111.445], ['Madiun', 172, -7.630, 111.525],
    ['Caruban', 190, -7.550, 111.660], ['Nganjuk', 222, -7.600, 111.900], ['Kertosono', 245, -7.580, 112.100], ['Jombang', 265, -7.550, 112.230],
    ['Mojokerto', 290, -7.470, 112.430], ['Krian', 310, -7.410, 112.580], ['Surabaya', 335]]),
  N('semsolo', 'Jalan Nasional Semarang–Solo', 'Semarang–Solo', 2, 80, [
    ['Semarang', 0], ['Ungaran', 22, -7.140, 110.400], ['Bawen', 35, -7.240, 110.430], ['Salatiga', 48, -7.330, 110.500],
    ['Boyolali', 75, -7.530, 110.600], ['Kartasura', 92]]),
  N('magelang', 'Jalan Nasional Bawen–Magelang–Yogyakarta', 'Bawen–Magelang', 1, 60, [
    ['Bawen', 0], ['Ambarawa', 5, -7.260, 110.400], ['Magelang', 40, -7.470, 110.220], ['Yogyakarta', 82]]),
  N('malang', 'Jalan Nasional Gempol–Malang', 'Gempol–Malang', 2, 70, [
    ['Gempol', 0], ['Pandaan', 12, -7.650, 112.690], ['Lawang', 32, -7.830, 112.700], ['Singosari', 40, -7.890, 112.670], ['Malang', 50, -7.980, 112.630]]),
  N('kediri', 'Jalan Nasional Malang–Blitar–Kediri–Kertosono', 'Malang–Kediri', 1, 60, [
    ['Malang', 0], ['Kepanjen', 20, -8.130, 112.570], ['Blitar', 75, -8.100, 112.170], ['Kediri', 115, -7.820, 112.010], ['Kertosono', 150]]),
  N('garut', 'Jalan Nasional Nagreg–Garut–Tasikmalaya', 'Nagreg–Garut', 1, 60, [
    ['Nagreg', 0], ['Garut', 25, -7.220, 107.900], ['Tasikmalaya', 80]]),
  N('kuningan', 'Jalan Nasional Cirebon–Kuningan–Ciamis', 'Cirebon–Kuningan', 1, 60, [
    ['Cirebon', 0], ['Kuningan', 35, -6.976, 108.484], ['Kawali', 70, -7.190, 108.370], ['Ciamis', 85]]),
  N('lembang', 'Jalan Nasional Bandung–Lembang–Subang–Pamanukan', 'Bandung–Subang', 1, 60, [
    ['Bandung', 0], ['Lembang', 15, -6.812, 107.618], ['Subang', 55, -6.570, 107.760], ['Pamanukan', 85]]),
  N('pelratu', 'Jalan Nasional Sukabumi–Palabuhanratu', 'Sukabumi–Palabuhanratu', 1, 60, [
    ['Sukabumi', 0], ['Palabuhanratu', 60, -6.985, 106.545]]),
  N('banten', 'Jalan Nasional Serang–Pandeglang–Labuan', 'Serang–Labuan', 1, 60, [
    ['Serang', 0], ['Pandeglang', 25, -6.310, 106.105], ['Labuan', 60, -6.378, 105.830]]),
  N('wonosobo', 'Jalan Nasional Purwokerto–Wonosobo–Magelang', 'Purwokerto–Magelang', 1, 60, [
    ['Purwokerto', 0], ['Purbalingga', 20, -7.390, 109.360], ['Banjarnegara', 50, -7.400, 109.690], ['Wonosobo', 80, -7.360, 109.900],
    ['Temanggung', 115, -7.320, 110.170], ['Magelang', 140]]),
  N('wonogiri', 'Jalan Nasional Solo–Wonogiri–Pacitan', 'Solo–Pacitan', 1, 60, [
    ['Solo', 0], ['Sukoharjo', 12, -7.680, 110.840], ['Wonogiri', 35, -7.810, 110.920], ['Pacitan', 110, -8.200, 111.100]]),
  N('ponorogo', 'Jalan Nasional Madiun–Ponorogo–Pacitan', 'Madiun–Pacitan', 1, 60, [
    ['Madiun', 0], ['Ponorogo', 30, -7.870, 111.460], ['Pacitan', 85]]),
  N('blora', 'Jalan Nasional Semarang–Purwodadi–Blora–Bojonegoro–Lamongan', 'Semarang–Bojonegoro', 1, 60, [
    ['Semarang', 0], ['Purwodadi', 60, -7.090, 110.920], ['Blora', 125, -6.970, 111.420], ['Cepu', 160, -7.150, 111.590],
    ['Bojonegoro', 195, -7.150, 111.880], ['Babat', 230, -7.110, 112.170], ['Lamongan', 260]]),
  N('tuban', 'Jalan Nasional Tuban–Bojonegoro', 'Tuban–Bojonegoro', 1, 60, [
    ['Tuban', 0], ['Bojonegoro', 45]]),
  N('batu', 'Jalan Nasional Malang–Batu–Kediri', 'Malang–Batu–Kediri', 1, 60, [
    ['Malang', 0], ['Batu', 18, -7.870, 112.520], ['Pujon', 30, -7.840, 112.460], ['Kediri', 85]]),
  N('tulungagung', 'Jalan Nasional Kediri–Tulungagung–Blitar', 'Kediri–Blitar', 1, 60, [
    ['Kediri', 0], ['Tulungagung', 30, -8.070, 111.900], ['Blitar', 60]]),
  N('bondowoso', 'Jalan Nasional Jember–Bondowoso–Situbondo', 'Jember–Situbondo', 1, 60, [
    ['Jember', 0], ['Bondowoso', 35, -7.910, 113.820], ['Situbondo', 70]]),
  N('jember', 'Jalan Nasional Probolinggo–Jember–Banyuwangi', 'Probolinggo–Jember', 1, 60, [
    ['Probolinggo', 0], ['Lumajang', 45, -8.130, 113.220], ['Jember', 110, -8.170, 113.700], ['Genteng', 165, -8.370, 114.150],
    ['Banyuwangi', 200, -8.220, 114.370], ['Ketapang', 208]]),
];

// kota tujuan untuk rambu (papan hijau)
const CITY = {
  'Merak':'Merak','Cilegon Timur':'Cilegon','Serang Timur':'Serang','Tangerang':'Tangerang','Cikupa':'Balaraja','JCT Tomang':'Jakarta',
  'JCT Cawang':'Jakarta','Bandara Soekarno-Hatta':'Bandara Soetta','Bekasi Barat':'Bekasi','Cikarang Barat':'Cikarang','Karawang Barat':'Karawang',
  'Cikampek':'Cikampek','JCT Pasir Koja':'Bandung','Pasteur':'Bandung','Sadang':'Purwakarta','Bogor':'Bogor','Sawangan':'Depok','JCT Ciawi':'Ciawi',
  'Cibadak':'Sukabumi','Sumedang':'Sumedang','Subang':'Subang','JCT Kertajati':'Kertajati','GT Palimanan':'Cirebon','Kedawung':'Cirebon',
  'Pejagan':'Brebes','Tegal':'Tegal','Pemalang':'Pemalang','Pekalongan':'Pekalongan','Batang':'Batang','Kendal':'Kendal',
  'Krapyak':'Semarang','GT Banyumanik':'Semarang','Salatiga':'Salatiga','Boyolali':'Boyolali','Colomadu':'Solo','JCT Kartasura':'Solo',
  'Prambanan':'Yogyakarta','Purwomartani':'Yogyakarta','Sragen':'Sragen','Ngawi':'Ngawi','Madiun':'Madiun','Nganjuk':'Nganjuk',
  'Jombang':'Jombang','Mojokerto Barat':'Mojokerto','JCT Waru':'Surabaya','Dupak':'Surabaya','Sidoarjo':'Sidoarjo','JCT Gempol':'Gempol',
  'Malang':'Malang','Pasuruan':'Pasuruan','Probolinggo Barat':'Probolinggo','Besuki':'Situbondo','Ketapang':'Banyuwangi','Demak':'Demak',
  'Bandara Juanda':'Bandara Juanda','Serpong':'Serpong','Soreang':'Soreang','JCT Cilincing':'Tj. Priok','Cileunyi':'Cileunyi',
  'Kaligawe':'Semarang','Penjaringan':'Pluit','JCT Pluit':'Pluit','Cigombong':'Sukabumi','Klaten':'Klaten','Kraksaan':'Kraksaan',
};

// ---------- build graph ----------
export const NODES = new Map();   // key -> {key, name, kind, lat, lon, corr:Set, city}
const keyOf = (c, n) => n.kind === 'r' ? `${c.id}:${n.name}` : c.cls === 'n' ? 'N:' + n.name : n.name;
for (const c of CORRIDORS) {
  c.nodes.sort((a, b) => a.km - b.km);
  for (const n of c.nodes) {
    n.key = keyOf(c, n);
    if (!NODES.has(n.key)) NODES.set(n.key, {key: n.key, name: n.name, kind: n.kind, lat: n.lat, lon: n.lon, corr: new Set(), city: CITY[n.name] || null});
    const N = NODES.get(n.key); N.corr.add(c.id);
    if (n.lat != null && N.lat == null) { N.lat = n.lat; N.lon = n.lon; }
    if (n.kind === 'j') N.kind = 'j';
  }
}
// interpolate missing coordinates along each corridor
for (let pass = 0; pass < 2; pass++) for (const c of CORRIDORS) {
  const ns = c.nodes, P = ns.map(n => NODES.get(n.key));
  for (let i = 0; i < ns.length; i++) { if (P[i].lat != null) continue;
    let a = i - 1; while (a >= 0 && P[a].lat == null) a--;
    let b = i + 1; while (b < ns.length && P[b].lat == null) b++;
    if (a >= 0 && b < ns.length) { const f = (ns[i].km - ns[a].km) / ((ns[b].km - ns[a].km) || 1);
      P[i].lat = P[a].lat + (P[b].lat - P[a].lat)*f; P[i].lon = P[a].lon + (P[b].lon - P[a].lon)*f; }
    else if (pass === 1) { const j = a >= 0 ? a : b; if (j >= 0 && j < ns.length) { P[i].lat = P[j].lat; P[i].lon = P[j].lon; } }
  }
}
for (const N of NODES.values()) if (N.kind === 'k' && !N.city) N.city = N.name;
const hav = (a, b) => { const R = 6371, r = Math.PI/180, dLa = (b.lat - a.lat)*r, dLo = (b.lon - a.lon)*r;
  const x = Math.sin(dLa/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(x)); };
// access roads: every toll exit links to the nearest town on the national network (within ~12 km)
const towns = [...NODES.values()].filter(n => n.kind === 'k');
for (const N of [...NODES.values()]) {
  if (N.kind !== 'x' && N.kind !== 't') continue;
  let best = null, bd = 12; for (const t of towns) { const d = hav(N, t); if (d < bd) { bd = d; best = t; } }
  if (!best) continue;
  const km = Math.max(1, Math.round(bd*1.3*10)/10), id = 'a:' + N.key, wide = [...best.corr].some(c => (CORRIDORS.find(q => q.id === c) || {}).lanes >= 2);
  CORRIDORS.push({id, name: `Jalan akses Gerbang Tol ${N.name}`, short: `Akses GT ${N.name}`, lanes: wide ? 2 : 1, limit: 60, planned: false, cls: 'a',
    nodes: [{name: N.name, km: 0, kind: N.kind, key: N.key}, {name: best.name, km, kind: 'k', key: best.key}]});
  N.corr.add(id); best.corr.add(id);
}
export const CORR = Object.fromEntries(CORRIDORS.map(c => [c.id, c]));
const SPEED = {t: 85, n: 50, a: 30};

// adjacency between consecutive routable nodes (rest areas are not routable); weights are hours
const ADJ = new Map();
for (const c of CORRIDORS) {
  const R = c.nodes.filter(n => n.kind !== 'r');
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i], b = R[i+1], km = Math.abs(b.km - a.km), w = km/SPEED[c.cls] + (c.cls === 'a' ? 0.03 : 0) + (c.planned ? 0.0001 : 0);
    for (const [p, q] of [[a, b], [b, a]]) { if (!ADJ.has(p.key)) ADJ.set(p.key, []); ADJ.get(p.key).push({to: q.key, c: c.id, cls: c.cls, w, km}); }
  }
}

// exits a trip can start or end at
export function placeList(){
  const out = [], seen = new Set();
  for (const c of CORRIDORS) { if (c.cls === 'a') continue;
    for (const n of c.nodes) if ((n.kind === 'x' || n.kind === 't' || n.kind === 'k') && !seen.has(n.key)) { seen.add(n.key);
      out.push({key: n.key, name: n.name, corr: c.id, group: (c.cls === 'n' ? 'Jalan Nasional · ' : 'Tol · ') + c.short, planned: c.planned, cls: c.cls}); } }
  return out;
}

// mode: 'mix' (fastest), 'toll' (toll roads only), 'nr' (national roads only)
// Tol Layang MBZ is for Gol I passenger cars only (sedan, SUV, pickup): other vehicles are never routed onto it
export const RULES = {noMbz: false, noToll: false};
const edgeOK = (e, mode) => !(mode === 'toll' && e.cls === 'n') && !(mode === 'nr' && e.cls === 't') && !(RULES.noMbz && e.c === 'mbz') && !(RULES.noToll && e.cls === 't');
// Dijkstra on travel time; ban = a neighbour of `from` that must not be the first hop (no U-turn on the spot)
export function findRoute(from, to, mode = 'mix', ban = null){
  const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
  while (true) {
    let u = null, best = Infinity;
    for (const [k, d] of dist) if (!done.has(k) && d < best) { best = d; u = k; }
    if (u === null) return null;
    if (u === to) break;
    done.add(u);
    for (const e of ADJ.get(u) || []) {
      if (!edgeOK(e, mode)) continue;
      if (u === from && e.to === ban) continue;
      const pe = prev.get(u);
      if (pe && pe.cls === 'a' && e.cls === 'a') continue;   // never use two access roads in a row as a shortcut
      const turn = pe && pe.c !== e.c ? 0.006 : 0;            // switching road costs a little
      const nd = best + e.w + turn;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, {from: u, c: e.c, cls: e.cls}); }
    }
  }
  const legs = []; let k = to;
  while (k !== from) { const p = prev.get(k); legs.unshift({a: p.from, b: k, c: p.c}); k = p.from; }
  return legs;
}
export const edgesFrom = key => ADJ.get(key) || [];
function bearing(a, b){ const A = NODES.get(a), B = NODES.get(b); return Math.atan2((B.lon - A.lon)*Math.cos(A.lat*Math.PI/180), B.lat - A.lat)*180/Math.PI; }
export function turnDeg(prev, n, to){ if (!prev) return 0; const d = bearing(n, to) - bearing(prev, n); return ((d + 540) % 360) - 180; }
export function turnName(prev, n, to){ const d = turnDeg(prev, n, to); return Math.abs(d) > 150 ? 'Putar balik' : Math.abs(d) < 35 ? 'Lurus' : d > 0 ? 'Kanan' : 'Kiri'; }
// furthest place along a road in the direction of an edge, for labels ("ke Bogor")
export function towardOf(key, e){ const c = CORR[e.c]; if (c.cls === 'a') return NODES.get(e.to).name;
  const i = c.nodes.findIndex(n => n.key === key), j = c.nodes.findIndex(n => n.key === e.to), st = j > i ? 1 : -1;
  let city = null, last = null; for (let k = j; k >= 0 && k < c.nodes.length; k += st) { const N = NODES.get(c.nodes[k].key); if (N.kind === 'r') continue; last = N.name; if (N.city) city = N.city; }
  return city || last || NODES.get(e.to).name; }
export function choicesAt(key, prev, mode = 'mix'){
  let opts = edgesFrom(key).filter(e => e.to !== prev && edgeOK(e, mode));
  if (!opts.length) opts = edgesFrom(key).filter(e => edgeOK(e, mode));      // dead end: only a U-turn is left
  return opts.map(e => ({e, turn: e.cls === 'a' && NODES.get(key).kind !== 'k' ? 'Keluar' : turnName(prev, key, e.to), road: CORR[e.c].cls === 'a' ? (NODES.get(key).kind === 'k' ? `Masuk tol lewat GT ${NODES.get(e.to).name}` : 'Keluar tol') : (CORR[e.c].cls === 'n' ? 'Jalan Nasional ' : 'Tol ') + CORR[e.c].short, toward: towardOf(key, e)})); }
// the "go straight" continuation: same road if possible, otherwise the smallest turn; access roads only when nothing else is left
export function straightOf(key, prev, prevC, mode = 'mix'){
  const opts = choicesAt(key, prev, mode).map(o => o.e); if (!opts.length) return null;
  const same = opts.find(o => o.c === prevC && o.to !== prev); if (same) return same;
  const pool = opts.filter(o => CORR[o.c].cls !== 'a'); const P = pool.length ? pool : opts;
  return P.map(o => ({o, d: Math.abs(turnDeg(prev, key, o.to))})).sort((a, b) => a.d - b.d)[0].o; }
export function walkFree(from, prev, prevC, first, maxKm, mode = 'mix'){
  const legs = []; let cur = from, pv = prev, pc = prevC, km = 0, e = first;
  for (let guard = 0; guard < 400 && km < maxKm; guard++) {
    if (!e) e = straightOf(cur, pv, pc, mode); if (!e) break;
    legs.push({a: cur, b: e.to, c: e.c}); km += e.km; pv = cur; pc = e.c; cur = e.to; e = null; }
  return legs; }

// every event (exit, junction, rest area, toll plaza, town) passed along the legs, in order, with route km
function legEvents(leg){
  const c = CORR[leg.c], ia = c.nodes.findIndex(n => n.key === leg.a), ib = c.nodes.findIndex(n => n.key === leg.b);
  const st = ib > ia ? 1 : -1, out = [];
  for (let i = ia + st; i !== ib + st; i += st) out.push({n: c.nodes[i], d: Math.abs(c.nodes[i].km - c.nodes[ia].km), c});
  return out;
}
const legKm = l => { const c = CORR[l.c]; return Math.abs(c.nodes.find(n => n.key === l.b).km - c.nodes.find(n => n.key === l.a).km); };
// dest = key of the destination (route / navigation), or null for free driving
export function tripFromLegs(from, legs, dest = null, mode = 'mix'){
  if (!legs.length) return null;
  const c0 = CORR[legs[0].c], n0 = c0.nodes.find(n => n.key === from);
  const ev = [{key: from, name: n0.name, kind: n0.kind, km: n0.km, rk: 0, c: legs[0].c, origin: true, legIdx: -1, end: true}];
  let rk = 0, destIdx = -1, tail = [];
  legs.forEach((leg, li) => {
    for (const {n, d, c} of legEvents(leg)) ev.push({key: n.key, name: n.name, kind: n.kind, km: n.km, rk: rk + d, c: c.id, legIdx: li, end: n.key === leg.b});
    rk += legKm(leg);
    if (dest && leg.b === dest && destIdx < 0 && li === legs.length - 1) destIdx = ev.length - 1;
  });
  if (destIdx >= 0) { ev[destIdx].dest = true;
    // keep the road going after the destination, so a missed exit still has somewhere to go
    const last = legs[legs.length - 1]; tail = walkFree(last.b, last.a, last.c, null, 25, mode);
    tail.forEach((leg, k) => { for (const {n, d, c} of legEvents(leg)) ev.push({key: n.key, name: n.name, kind: n.kind, km: n.km, rk: rk + d, c: c.id, legIdx: legs.length + k, end: n.key === leg.b, tail: true}); rk += legKm(leg); });
  }
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i], N = NODES.get(e.key);
    e.lat = N.lat; e.lon = N.lon; e.city = N.city;
    e.cNext = i + 1 < ev.length ? ev[i+1].c : e.c;
    e.turn = e.kind === 'j' && e.cNext !== e.c;
    if (e.kind === 'j') e.others = [...N.corr].filter(id => id !== e.c && id !== e.cNext && CORR[id].cls === 't');
    // toll gates where the route changes between toll and non-toll roads
    const pc = CORR[e.origin ? e.cNext : e.c].cls, nc = CORR[e.cNext].cls;
    if ('xtg'.includes(e.kind)) {
      if (pc === 't' && nc !== 't') e.kind = 'te';
      else if (pc !== 't' && nc === 't') e.kind = 'ti';
      else if (pc !== 't' && nc !== 't') e.kind = 'n0';
    }
  }
  return {from, dest, mode, legs, allLegs: legs.concat(tail), ev, destIdx, total: destIdx >= 0 ? ev[destIdx].rk : rk, free: !dest,
    corridors: [...new Set(legs.map(l => l.c))].filter(c => CORR[c].cls !== 'a'),
    tollKm: legs.filter(l => CORR[l.c].cls === 't').reduce((a, l) => a + legKm(l), 0)};
}
export function buildTrip(from, to, mode = 'mix'){ const legs = findRoute(from, to, mode); return legs && legs.length ? tripFromLegs(from, legs, to, mode) : null; }

export const fmtKm = km => km < 1 ? `${Math.round(km*1000/50)*50} m` : `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
export const nodeLabel = n => n.kind === 'j' ? n.name.replace('JCT ', 'Simpang Susun ') : n.kind === 'g' || n.kind === 't' ? n.name.replace('GT ', 'Gerbang Tol ')
  : n.kind === 'te' || n.kind === 'ti' ? 'Gerbang Tol ' + n.name.replace('GT ', '') : n.name;

// ---------- road shapes for the maps: a smooth curve through every place on a road, plus shape points where it bends in between ----------
// SHAPE[corridor]['A>B'] = [[lat, lon], …] between consecutive places A and B (in KM order)
const SHAPE = {
  cipularang: {'Jatiluhur>Rest Area KM 88': [[-6.575, 107.405]], 'Rest Area KM 97>JCT Padalarang': [[-6.715, 107.432], [-6.765, 107.445], [-6.810, 107.465]]},
  cipali: {'Subang>Rest Area KM 102': [[-6.532, 107.790]], 'Cikedung>JCT Kertajati': [[-6.560, 108.170]], 'Sumberjaya>GT Palimanan': [[-6.690, 108.380]]},
  pantura2: {'Cikampek>Pamanukan': [[-6.380, 107.560], [-6.330, 107.700]], 'Pamanukan>Lohbener': [[-6.300, 107.960], [-6.340, 108.100], [-6.380, 108.200]],
    'Jatibarang>Cirebon': [[-6.540, 108.380], [-6.620, 108.470]]},
  pantura3: {'Cirebon>Losari': [[-6.760, 108.640]]},
  pantura4: {'Rembang>Lasem': [[-6.690, 111.400]], 'Lasem>Tuban': [[-6.660, 111.560], [-6.725, 111.700], [-6.780, 111.860], [-6.830, 111.980]],
    'Tuban>Lamongan': [[-6.990, 112.120], [-7.090, 112.180], [-7.120, 112.300]], 'Lamongan>Gresik': [[-7.150, 112.530]]},
  pantura5: {'Situbondo>Ketapang': [[-7.740, 114.120], [-7.760, 114.240], [-7.830, 114.380], [-7.950, 114.430], [-8.050, 114.420]],
    'Probolinggo>Kraksaan': [[-7.770, 113.320]], 'Kraksaan>Besuki': [[-7.740, 113.560]]},
  probo2: {'Asembagus>Ketapang': [[-7.830, 114.370], [-7.950, 114.420], [-8.050, 114.410]]},
  jember: {'Probolinggo>Lumajang': [[-7.900, 113.240], [-8.020, 113.230]], 'Jember>Genteng': [[-8.200, 113.800], [-8.240, 113.900], [-8.290, 113.980], [-8.320, 114.070]],
    'Genteng>Banyuwangi': [[-8.330, 114.280]]},
  lumjem: {'Jatiroto>Jember': [[-8.160, 113.450], [-8.200, 113.610]]},
  selatan1: {'Nagreg>Malangbong': [[-7.060, 108.000]], 'Malangbong>Tasikmalaya': [[-7.150, 108.130], [-7.250, 108.180]], 'Banjar>Wangon': [[-7.310, 108.660], [-7.300, 108.760], [-7.380, 108.880], [-7.480, 108.980]],
    'Wangon>Kebumen': [[-7.550, 109.180], [-7.610, 109.360], [-7.610, 109.510]], 'Kebumen>Purworejo': [[-7.720, 109.790], [-7.720, 109.910]]},
  kediri: {'Kepanjen>Blitar': [[-8.160, 112.480], [-8.080, 112.320], [-8.100, 112.240]], 'Blitar>Kediri': [[-7.980, 112.090]]},
  blora: {'Semarang>Purwodadi': [[-7.030, 110.520], [-7.040, 110.760]], 'Purwodadi>Blora': [[-7.080, 111.120], [-7.040, 111.250]], 'Cepu>Bojonegoro': [[-7.170, 111.730]]},
  wonogiri: {'Wonogiri>Pacitan': [[-7.980, 110.930], [-8.060, 110.960], [-8.130, 111.020]]},
  pelratu: {'Sukabumi>Palabuhanratu': [[-6.950, 106.800], [-6.980, 106.680]]},
  madura: {'Surabaya>Bangkalan': [[-7.215, 112.775], [-7.155, 112.785], [-7.100, 112.770]], 'Bangkalan>Sampang': [[-7.120, 112.900], [-7.200, 113.060]],
    'Sampang>Pamekasan': [[-7.200, 113.360]], 'Pamekasan>Sumenep': [[-7.110, 113.630], [-7.060, 113.760]]},
  'p-tawangmangu': {'Karanganyar>Tawangmangu': [[-7.625, 111.030], [-7.650, 111.090]]},
  'p-dieng': {'Wonosobo>Dieng': [[-7.300, 109.920], [-7.255, 109.900]]},
  'p-bromo': {'Probolinggo>Sukapura': [[-7.800, 113.180], [-7.850, 113.120]]},
  'p-majalengka': {'Sumber (Cirebon)>Majalengka': [[-6.800, 108.380], [-6.830, 108.300]]},
  maduraut: {'Bangkalan>Arosbaya': [[-7.000, 112.790]], 'Arosbaya>Tanjung Bumi': [[-6.920, 112.970]], 'Tanjung Bumi>Ketapang Sampang': [[-6.890, 113.190]],
    'Ketapang Sampang>Pasongsongan': [[-6.890, 113.450]], 'Ambunten>Sumenep': [[-6.950, 113.800]]},
};
const hav2 = (a, b) => hav(a, b);
const GEO = new Map();
// dense polyline [{lat, lon, km}] of a road: centripetal Catmull–Rom through its places and shape points
export function corrGeo(id){
  if (GEO.has(id)) return GEO.get(id); const c = CORR[id]; if (!c) return null;
  const ctl = [];
  c.nodes.forEach((n, i) => { const P = NODES.get(n.key); if (!P || P.lat == null) return;
    const q = {lat: P.lat, lon: P.lon, km: n.km}, last = ctl[ctl.length - 1];
    if (last) { const sh = (SHAPE[id] || {})[`${c.nodes[i - 1].name}>${n.name}`];
      if (sh) { const pts = [last, ...sh.map(([lat, lon]) => ({lat, lon})), q]; let tot = 0; const d = [0]; for (let k = 1; k < pts.length; k++) { tot += hav2(pts[k - 1], pts[k]); d.push(tot); }
        for (let k = 1; k < pts.length - 1; k++) ctl.push({lat: pts[k].lat, lon: pts[k].lon, km: last.km + (q.km - last.km)*d[k]/(tot || 1)}); } }
    const l2 = ctl[ctl.length - 1]; if (l2 && hav2(l2, q) < 0.3) { if (q.km > l2.km) l2.km = q.km; return; } ctl.push(q); });
  const out = [];
  if (ctl.length === 1) out.push(ctl[0]);
  const T = (a, b) => Math.sqrt(Math.max(1e-9, hav2(a, b)));
  for (let i = 0; i < ctl.length - 1; i++) {
    const p1 = ctl[i], p2 = ctl[i + 1], p0 = ctl[i - 1] || {lat: 2*p1.lat - p2.lat, lon: 2*p1.lon - p2.lon}, p3 = ctl[i + 2] || {lat: 2*p2.lat - p1.lat, lon: 2*p2.lon - p1.lon};
    const t1 = T(p0, p1), t2 = t1 + T(p1, p2), t3 = t2 + T(p2, p3), n = Math.max(2, Math.ceil(hav2(p1, p2)/1.2));
    for (let k = 0; k < n; k++) { const t = t1 + (t2 - t1)*k/n, L = (a, b, ta, tb, f) => (tb - t)/(tb - ta)*a[f] + (t - ta)/(tb - ta)*b[f];
      const pt = {}; for (const f of ['lat', 'lon']) { const A1 = L(p0, p1, 0, t1, f), A2 = L(p1, p2, t1, t2, f), A3 = L(p2, p3, t2, t3, f);
        const B1 = (t2 - t)/t2*A1 + t/t2*A2, B2 = (t3 - t)/(t3 - t1)*A2 + (t - t1)/(t3 - t1)*A3; pt[f] = (t2 - t)/(t2 - t1)*B1 + (t - t1)/(t2 - t1)*B2; }
      pt.km = p1.km + (p2.km - p1.km)*k/n; out.push(pt); } }
  if (ctl.length > 1) out.push(ctl[ctl.length - 1]);
  GEO.set(id, out); return out;
}
// position on a road's curve at a KM
export function corrLL(id, km){ const g = corrGeo(id); if (!g || !g.length) return null;
  if (km <= g[0].km) return g[0]; if (km >= g[g.length - 1].km) return g[g.length - 1];
  let lo = 0, hi = g.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (g[m].km <= km) lo = m; else hi = m; }
  const a = g[lo], b = g[hi], f = (km - a.km)/((b.km - a.km) || 1); return {lat: a.lat + (b.lat - a.lat)*f, lon: a.lon + (b.lon - a.lon)*f}; }

// Madura coastline [lon, lat]
export const MADURA = [[112.69,-6.99],[112.85,-6.89],[113.1,-6.87],[113.4,-6.86],[113.7,-6.86],[113.95,-6.9],[114.12,-6.97],[114.1,-7.07],[113.92,-7.1],
  [113.6,-7.22],[113.3,-7.23],[113.0,-7.25],[112.85,-7.17],[112.73,-7.13],[112.69,-7.06]];

// real coastlines [lon, lat] of Java, Madura and the small islands around them: Natural Earth 1:10m land (public domain)
export const COAST = {"JAVA":[[109.906,-7.838],[109.883,-7.845],[109.847,-7.837],[109.812,-7.823],[109.752,-7.812],[109.657,-7.782],[109.486,-7.762],[109.447,-7.772],[109.426,-7.774],[109.417,-7.765],[109.415,-7.758],[109.409,-7.755],[109.402,-7.753],[109.397,-7.747],[109.397,-7.742],[109.405,-7.731],[109.403,-7.726],[109.398,-7.723],[109.369,-7.713],[109.197,-7.696],[109.098,-7.687],[109.047,-7.702],[109.033,-7.72],[109.021,-7.732],[109.014,-7.733],[108.984,-7.707],[108.974,-7.702],[108.962,-7.7],[108.939,-7.699],[108.918,-7.696],[108.902,-7.69],[108.89,-7.679],[108.882,-7.633],[108.873,-7.611],[108.859,-7.614],[108.852,-7.619],[108.827,-7.631],[108.82,-7.638],[108.807,-7.658],[108.799,-7.665],[108.788,-7.674],[108.761,-7.693],[108.735,-7.679],[108.729,-7.676],[108.722,-7.67],[108.714,-7.666],[108.704,-7.666],[108.692,-7.672],[108.682,-7.682],[108.673,-7.691],[108.68,-7.71],[108.678,-7.719],[108.673,-7.721],[108.652,-7.716],[108.646,-7.693],[108.639,-7.688],[108.625,-7.686],[108.559,-7.687],[108.54,-7.692],[108.508,-7.719],[108.504,-7.764],[108.495,-7.793],[108.454,-7.819],[108.327,-7.817],[108.138,-7.787],[107.954,-7.74],[107.905,-7.739],[107.865,-7.745],[107.83,-7.729],[107.828,-7.7],[107.807,-7.687],[107.779,-7.68],[107.714,-7.672],[107.687,-7.662],[107.678,-7.64],[107.661,-7.614],[107.625,-7.598],[107.591,-7.57],[107.555,-7.562],[107.529,-7.549],[107.481,-7.538],[107.471,-7.517],[107.452,-7.513],[107.432,-7.507],[107.426,-7.508],[107.42,-7.506],[107.411,-7.496],[107.362,-7.504],[107.298,-7.496],[107.246,-7.49],[107.212,-7.485],[107.18,-7.476],[107.146,-7.467],[107.107,-7.456],[106.871,-7.438],[106.791,-7.435],[106.608,-7.418],[106.523,-7.411],[106.481,-7.376],[106.459,-7.366],[106.434,-7.362],[106.407,-7.375],[106.398,-7.378],[106.399,-7.36],[106.399,-7.335],[106.375,-7.31],[106.383,-7.268],[106.381,-7.247],[106.386,-7.231],[106.398,-7.208],[106.415,-7.188],[106.433,-7.179],[106.45,-7.179],[106.467,-7.176],[106.473,-7.167],[106.457,-7.145],[106.474,-7.128],[106.514,-7.08],[106.541,-7.055],[106.542,-7.017],[106.537,-6.983],[106.511,-6.964],[106.481,-6.967],[106.452,-6.955],[106.424,-6.963],[106.405,-6.991],[106.402,-6.993],[106.379,-7.0],[106.355,-7.003],[106.333,-7.001],[106.32,-6.996],[106.311,-6.991],[106.302,-6.988],[106.289,-6.987],[106.283,-6.983],[106.273,-6.969],[106.268,-6.966],[106.254,-6.964],[106.25,-6.96],[106.249,-6.953],[106.244,-6.946],[106.238,-6.941],[106.201,-6.914],[106.168,-6.916],[106.125,-6.896],[106.053,-6.837],[106.008,-6.822],[105.979,-6.818],[105.96,-6.818],[105.94,-6.821],[105.919,-6.824],[105.902,-6.83],[105.898,-6.843],[105.884,-6.848],[105.874,-6.835],[105.855,-6.838],[105.823,-6.839],[105.792,-6.846],[105.775,-6.85],[105.756,-6.845],[105.723,-6.839],[105.703,-6.836],[105.597,-6.849],[105.555,-6.856],[105.535,-6.872],[105.498,-6.861],[105.486,-6.868],[105.471,-6.853],[105.46,-6.845],[105.442,-6.843],[105.439,-6.846],[105.43,-6.853],[105.42,-6.857],[105.416,-6.853],[105.414,-6.846],[105.409,-6.838],[105.403,-6.832],[105.398,-6.83],[105.356,-6.813],[105.311,-6.81],[105.301,-6.814],[105.296,-6.833],[105.291,-6.841],[105.284,-6.847],[105.275,-6.849],[105.256,-6.842],[105.247,-6.825],[105.236,-6.788],[105.222,-6.778],[105.217,-6.772],[105.22,-6.764],[105.227,-6.763],[105.261,-6.767],[105.275,-6.762],[105.292,-6.748],[105.319,-6.72],[105.329,-6.703],[105.336,-6.685],[105.346,-6.671],[105.364,-6.665],[105.376,-6.67],[105.39,-6.681],[105.401,-6.695],[105.408,-6.706],[105.411,-6.718],[105.41,-6.729],[105.412,-6.739],[105.435,-6.778],[105.441,-6.794],[105.454,-6.809],[105.471,-6.816],[105.49,-6.809],[105.503,-6.791],[105.517,-6.744],[105.529,-6.723],[105.607,-6.651],[105.622,-6.632],[105.628,-6.616],[105.619,-6.533],[105.644,-6.482],[105.656,-6.473],[105.678,-6.475],[105.682,-6.512],[105.699,-6.521],[105.711,-6.535],[105.739,-6.53],[105.782,-6.512],[105.809,-6.477],[105.824,-6.435],[105.821,-6.401],[105.832,-6.229],[105.84,-6.192],[105.867,-6.11],[105.888,-6.071],[105.957,-5.999],[105.967,-5.993],[105.977,-5.983],[105.997,-5.918],[106.02,-5.893],[106.053,-5.881],[106.085,-5.886],[106.107,-5.911],[106.112,-5.975],[106.118,-5.986],[106.129,-5.99],[106.159,-6.01],[106.176,-6.014],[106.209,-5.998],[106.231,-5.967],[106.257,-5.942],[106.299,-5.945],[106.361,-5.993],[106.385,-6.0],[106.409,-6.004],[106.47,-6.034],[106.495,-6.035],[106.512,-6.025],[106.528,-6.012],[106.549,-6.007],[106.663,-6.008],[106.685,-6.012],[106.706,-6.02],[106.721,-6.031],[106.729,-6.048],[106.731,-6.059],[106.732,-6.067],[106.738,-6.084],[106.752,-6.096],[106.793,-6.104],[106.838,-6.103],[106.988,-6.079],[106.993,-6.079],[107.005,-6.072],[107.009,-6.053],[107.014,-6.04],[107.015,-6.029],[107.005,-6.014],[106.999,-6.004],[107.005,-5.988],[107.026,-5.959],[107.021,-5.924],[107.044,-5.914],[107.08,-5.922],[107.114,-5.938],[107.126,-5.949],[107.136,-5.962],[107.15,-5.973],[107.17,-5.98],[107.188,-5.98],[107.205,-5.977],[107.281,-5.955],[107.321,-5.962],[107.354,-5.976],[107.38,-6.009],[107.413,-6.063],[107.446,-6.104],[107.47,-6.145],[107.511,-6.164],[107.563,-6.184],[107.621,-6.187],[107.655,-6.225],[107.678,-6.238],[107.7,-6.227],[107.716,-6.236],[107.732,-6.233],[107.745,-6.223],[107.768,-6.213],[107.774,-6.208],[107.783,-6.206],[107.793,-6.208],[107.803,-6.212],[107.81,-6.211],[107.813,-6.202],[107.811,-6.189],[107.826,-6.185],[107.848,-6.192],[107.849,-6.206],[107.864,-6.206],[107.878,-6.191],[107.885,-6.187],[107.896,-6.21],[107.896,-6.231],[107.947,-6.263],[107.99,-6.281],[108.049,-6.31],[108.074,-6.318],[108.094,-6.327],[108.113,-6.327],[108.129,-6.326],[108.142,-6.323],[108.158,-6.312],[108.184,-6.297],[108.187,-6.295],[108.195,-6.287],[108.204,-6.276],[108.207,-6.263],[108.205,-6.25],[108.198,-6.241],[108.187,-6.231],[108.198,-6.228],[108.216,-6.238],[108.249,-6.247],[108.311,-6.249],[108.332,-6.262],[108.339,-6.251],[108.36,-6.246],[108.365,-6.273],[108.372,-6.34],[108.455,-6.442],[108.475,-6.452],[108.488,-6.457],[108.54,-6.487],[108.575,-6.67],[108.605,-6.762],[108.663,-6.767],[108.705,-6.796],[108.749,-6.812],[108.792,-6.811],[108.835,-6.788],[108.843,-6.798],[108.859,-6.802],[108.876,-6.805],[108.89,-6.809],[108.895,-6.814],[108.904,-6.822],[108.912,-6.835],[108.923,-6.845],[108.945,-6.849],[108.969,-6.848],[108.983,-6.842],[108.991,-6.828],[108.993,-6.805],[109.001,-6.789],[109.021,-6.789],[109.042,-6.796],[109.053,-6.802],[109.092,-6.831],[109.115,-6.839],[109.143,-6.856],[109.15,-6.857],[109.177,-6.856],[109.352,-6.876],[109.438,-6.86],[109.493,-6.802],[109.532,-6.835],[109.726,-6.863],[109.896,-6.918],[109.941,-6.923],[109.984,-6.923],[110.114,-6.904],[110.139,-6.897],[110.15,-6.887],[110.153,-6.882],[110.17,-6.861],[110.178,-6.856],[110.188,-6.86],[110.192,-6.87],[110.194,-6.881],[110.198,-6.891],[110.213,-6.9],[110.259,-6.921],[110.293,-6.931],[110.335,-6.961],[110.356,-6.973],[110.381,-6.976],[110.399,-6.968],[110.415,-6.957],[110.435,-6.952],[110.456,-6.951],[110.472,-6.946],[110.486,-6.938],[110.527,-6.895],[110.572,-6.836],[110.645,-6.688],[110.657,-6.644],[110.663,-6.606],[110.665,-6.565],[110.67,-6.546],[110.678,-6.535],[110.682,-6.522],[110.671,-6.5],[110.692,-6.496],[110.702,-6.489],[110.719,-6.466],[110.73,-6.457],[110.781,-6.436],[110.808,-6.432],[110.818,-6.428],[110.834,-6.421],[110.842,-6.418],[110.903,-6.411],[110.925,-6.404],[110.934,-6.411],[110.962,-6.428],[110.973,-6.432],[110.992,-6.432],[111.002,-6.431],[111.007,-6.428],[111.011,-6.421],[111.019,-6.426],[111.027,-6.435],[111.028,-6.438],[111.041,-6.447],[111.052,-6.457],[111.059,-6.47],[111.065,-6.509],[111.082,-6.544],[111.119,-6.65],[111.137,-6.685],[111.144,-6.692],[111.151,-6.693],[111.157,-6.692],[111.343,-6.713],[111.366,-6.712],[111.408,-6.702],[111.429,-6.699],[111.444,-6.689],[111.478,-6.64],[111.493,-6.623],[111.52,-6.64],[111.577,-6.651],[111.61,-6.665],[111.621,-6.675],[111.655,-6.716],[111.673,-6.734],[111.695,-6.755],[111.717,-6.771],[111.74,-6.782],[111.807,-6.799],[111.849,-6.804],[111.866,-6.808],[111.882,-6.809],[111.904,-6.802],[111.937,-6.785],[111.959,-6.779],[111.976,-6.785],[112.01,-6.819],[112.068,-6.894],[112.084,-6.906],[112.107,-6.911],[112.151,-6.91],[112.193,-6.905],[112.227,-6.893],[112.237,-6.891],[112.278,-6.891],[112.299,-6.887],[112.34,-6.873],[112.364,-6.871],[112.4,-6.877],[112.415,-6.883],[112.422,-6.879],[112.429,-6.873],[112.435,-6.871],[112.455,-6.875],[112.471,-6.887],[112.486,-6.901],[112.501,-6.911],[112.523,-6.918],[112.543,-6.918],[112.557,-6.908],[112.563,-6.887],[112.562,-6.874],[112.563,-6.867],[112.568,-6.865],[112.583,-6.871],[112.59,-6.876],[112.596,-6.885],[112.601,-6.896],[112.604,-6.905],[112.603,-6.926],[112.587,-6.966],[112.583,-6.99],[112.587,-7.0],[112.61,-7.033],[112.618,-7.041],[112.629,-7.045],[112.643,-7.039],[112.657,-7.038],[112.666,-7.055],[112.634,-7.064],[112.618,-7.071],[112.611,-7.079],[112.614,-7.091],[112.623,-7.108],[112.633,-7.124],[112.642,-7.131],[112.658,-7.138],[112.675,-7.154],[112.684,-7.175],[112.679,-7.193],[112.664,-7.199],[112.604,-7.193],[112.62,-7.215],[112.646,-7.23],[112.701,-7.255],[112.716,-7.239],[112.73,-7.22],[112.745,-7.205],[112.768,-7.199],[112.784,-7.205],[112.798,-7.219],[112.809,-7.235],[112.823,-7.263],[112.827,-7.278],[112.826,-7.293],[112.818,-7.33],[112.816,-7.347],[112.816,-7.387],[112.807,-7.407],[112.77,-7.433],[112.761,-7.449],[112.761,-7.531],[112.845,-7.593],[112.972,-7.648],[112.99,-7.652],[113.016,-7.652],[113.037,-7.655],[113.056,-7.663],[113.076,-7.679],[113.112,-7.713],[113.133,-7.728],[113.165,-7.736],[113.187,-7.745],[113.2,-7.747],[113.208,-7.746],[113.23,-7.741],[113.241,-7.741],[113.261,-7.75],[113.285,-7.782],[113.299,-7.789],[113.323,-7.786],[113.343,-7.778],[113.378,-7.754],[113.414,-7.736],[113.436,-7.729],[113.457,-7.726],[113.473,-7.722],[113.505,-7.704],[113.529,-7.7],[113.659,-7.72],[113.671,-7.718],[113.691,-7.709],[113.7,-7.707],[113.723,-7.708],[113.763,-7.723],[113.786,-7.726],[113.804,-7.722],[113.817,-7.711],[113.837,-7.686],[113.855,-7.677],[113.87,-7.678],[113.886,-7.683],[113.909,-7.686],[113.931,-7.684],[113.945,-7.678],[114.016,-7.618],[114.046,-7.612],[114.077,-7.631],[114.117,-7.681],[114.14,-7.701],[114.172,-7.713],[114.196,-7.714],[114.237,-7.703],[114.259,-7.7],[114.274,-7.705],[114.31,-7.741],[114.325,-7.75],[114.334,-7.753],[114.348,-7.754],[114.37,-7.753],[114.381,-7.754],[114.389,-7.758],[114.407,-7.773],[114.446,-7.795],[114.46,-7.81],[114.467,-7.831],[114.466,-7.853],[114.46,-7.895],[114.457,-7.903],[114.445,-7.921],[114.44,-7.933],[114.44,-7.944],[114.443,-7.952],[114.445,-7.96],[114.447,-7.967],[114.447,-8.014],[114.405,-8.158],[114.366,-8.357],[114.364,-8.386],[114.359,-8.409],[114.358,-8.419],[114.36,-8.431],[114.372,-8.453],[114.373,-8.498],[114.377,-8.519],[114.389,-8.528],[114.401,-8.517],[114.405,-8.492],[114.406,-8.447],[114.423,-8.465],[114.427,-8.497],[114.426,-8.562],[114.433,-8.583],[114.445,-8.603],[114.461,-8.618],[114.478,-8.625],[114.498,-8.625],[114.511,-8.628],[114.536,-8.645],[114.589,-8.664],[114.597,-8.676],[114.603,-8.688],[114.616,-8.7],[114.626,-8.716],[114.625,-8.741],[114.597,-8.776],[114.555,-8.778],[114.468,-8.748],[114.445,-8.744],[114.389,-8.748],[114.367,-8.741],[114.37,-8.726],[114.392,-8.7],[114.385,-8.665],[114.35,-8.633],[114.303,-8.612],[114.262,-8.611],[114.221,-8.636],[114.197,-8.646],[114.187,-8.635],[114.175,-8.62],[114.148,-8.622],[114.104,-8.638],[114.095,-8.638],[114.059,-8.631],[114.051,-8.627],[114.042,-8.608],[114.032,-8.604],[114.012,-8.609],[113.995,-8.618],[113.98,-8.62],[113.968,-8.604],[113.969,-8.594],[113.973,-8.58],[113.974,-8.568],[113.964,-8.562],[113.954,-8.565],[113.934,-8.574],[113.923,-8.577],[113.906,-8.574],[113.88,-8.566],[113.854,-8.555],[113.837,-8.542],[113.832,-8.547],[113.828,-8.549],[113.826,-8.551],[113.823,-8.556],[113.819,-8.542],[113.814,-8.508],[113.806,-8.501],[113.791,-8.503],[113.774,-8.508],[113.76,-8.516],[113.755,-8.525],[113.751,-8.528],[113.742,-8.529],[113.724,-8.528],[113.72,-8.525],[113.722,-8.507],[113.72,-8.501],[113.707,-8.492],[113.699,-8.494],[113.689,-8.497],[113.673,-8.495],[113.658,-8.485],[113.64,-8.459],[113.628,-8.453],[113.597,-8.447],[113.591,-8.442],[113.579,-8.429],[113.573,-8.426],[113.541,-8.431],[113.527,-8.429],[113.49,-8.408],[113.484,-8.402],[113.479,-8.395],[113.472,-8.382],[113.467,-8.378],[113.446,-8.376],[113.429,-8.384],[113.414,-8.39],[113.395,-8.381],[113.346,-8.324],[113.323,-8.309],[113.282,-8.292],[113.241,-8.281],[113.198,-8.277],[113.07,-8.292],[113.027,-8.303],[112.987,-8.323],[112.937,-8.381],[112.903,-8.404],[112.871,-8.392],[112.857,-8.393],[112.834,-8.376],[112.83,-8.381],[112.826,-8.39],[112.818,-8.397],[112.808,-8.399],[112.799,-8.395],[112.79,-8.388],[112.784,-8.387],[112.769,-8.395],[112.755,-8.408],[112.748,-8.413],[112.733,-8.418],[112.717,-8.419],[112.702,-8.422],[112.69,-8.43],[112.673,-8.447],[112.656,-8.436],[112.612,-8.416],[112.573,-8.41],[112.521,-8.392],[112.442,-8.392],[112.427,-8.388],[112.414,-8.379],[112.399,-8.372],[112.377,-8.371],[112.381,-8.361],[112.384,-8.358],[112.366,-8.342],[112.342,-8.333],[112.316,-8.329],[112.295,-8.33],[112.285,-8.333],[112.258,-8.343],[112.244,-8.342],[112.238,-8.338],[112.233,-8.334],[112.227,-8.33],[112.209,-8.324],[112.025,-8.305],[112.003,-8.298],[111.971,-8.278],[111.961,-8.278],[111.936,-8.295],[111.932,-8.3],[111.927,-8.303],[111.919,-8.303],[111.899,-8.296],[111.875,-8.274],[111.86,-8.269],[111.834,-8.271],[111.822,-8.269],[111.811,-8.264],[111.802,-8.259],[111.792,-8.257],[111.781,-8.261],[111.771,-8.282],[111.772,-8.302],[111.77,-8.317],[111.751,-8.323],[111.747,-8.318],[111.742,-8.306],[111.735,-8.294],[111.726,-8.289],[111.717,-8.293],[111.712,-8.302],[111.706,-8.323],[111.702,-8.327],[111.697,-8.337],[111.695,-8.346],[111.709,-8.354],[111.711,-8.361],[111.708,-8.368],[111.696,-8.371],[111.673,-8.368],[111.654,-8.358],[111.639,-8.343],[111.631,-8.323],[111.624,-8.323],[111.613,-8.337],[111.596,-8.334],[111.562,-8.317],[111.548,-8.316],[111.533,-8.327],[111.518,-8.33],[111.449,-8.313],[111.442,-8.297],[111.444,-8.285],[111.442,-8.276],[111.425,-8.269],[111.417,-8.269],[111.4,-8.274],[111.39,-8.275],[111.384,-8.273],[111.372,-8.264],[111.363,-8.261],[111.312,-8.261],[111.301,-8.263],[111.295,-8.26],[111.284,-8.251],[111.276,-8.248],[111.266,-8.249],[111.257,-8.253],[111.253,-8.258],[111.171,-8.283],[111.162,-8.282],[111.158,-8.272],[111.155,-8.261],[111.148,-8.254],[111.138,-8.249],[111.127,-8.248],[111.115,-8.242],[111.111,-8.229],[111.11,-8.215],[111.103,-8.207],[111.096,-8.208],[111.091,-8.216],[111.087,-8.225],[111.082,-8.233],[111.073,-8.247],[111.067,-8.253],[111.058,-8.255],[111.017,-8.255],[110.998,-8.25],[110.931,-8.22],[110.848,-8.201],[110.715,-8.193],[110.706,-8.19],[110.691,-8.176],[110.681,-8.173],[110.661,-8.17],[110.639,-8.163],[110.603,-8.145],[110.603,-8.152],[110.549,-8.128],[110.521,-8.12],[110.496,-8.117],[110.477,-8.112],[110.411,-8.076],[110.401,-8.075],[110.389,-8.075],[110.38,-8.073],[110.377,-8.066],[110.352,-8.042],[110.347,-8.039],[110.328,-8.021],[110.319,-8.019],[110.287,-8.015],[110.034,-7.885],[109.932,-7.855]],"MADURA":[[114.046,-6.915],[114.066,-6.923],[114.094,-6.933],[114.11,-6.947],[114.125,-6.982],[114.097,-6.983],[114.051,-7.011],[113.981,-7.021],[113.956,-7.045],[113.936,-7.05],[113.91,-7.048],[113.892,-7.059],[113.871,-7.095],[113.886,-7.1],[113.895,-7.109],[113.895,-7.121],[113.873,-7.129],[113.833,-7.132],[113.777,-7.125],[113.706,-7.114],[113.687,-7.113],[113.665,-7.11],[113.645,-7.131],[113.61,-7.129],[113.593,-7.139],[113.583,-7.153],[113.577,-7.168],[113.57,-7.182],[113.566,-7.194],[113.559,-7.212],[113.549,-7.234],[113.534,-7.24],[113.513,-7.248],[113.507,-7.24],[113.495,-7.231],[113.472,-7.222],[113.423,-7.227],[113.269,-7.217],[113.251,-7.21],[113.234,-7.208],[113.187,-7.223],[113.166,-7.22],[113.159,-7.185],[113.153,-7.177],[113.146,-7.172],[113.146,-7.166],[113.159,-7.158],[113.159,-7.151],[113.146,-7.15],[113.122,-7.139],[113.114,-7.141],[113.11,-7.151],[113.11,-7.171],[113.103,-7.179],[113.116,-7.191],[113.135,-7.203],[113.149,-7.215],[113.145,-7.227],[113.128,-7.231],[112.818,-7.161],[112.778,-7.158],[112.743,-7.161],[112.726,-7.159],[112.72,-7.148],[112.717,-7.118],[112.719,-7.103],[112.727,-7.09],[112.72,-7.083],[112.71,-7.097],[112.701,-7.092],[112.695,-7.076],[112.693,-7.059],[112.695,-7.039],[112.701,-7.033],[112.714,-7.032],[112.734,-7.028],[112.764,-7.011],[112.793,-6.984],[112.844,-6.925],[112.842,-6.909],[112.873,-6.898],[112.915,-6.892],[112.944,-6.891],[112.982,-6.891],[113.067,-6.881],[113.146,-6.894],[113.273,-6.893],[113.446,-6.882],[113.526,-6.896],[113.672,-6.879],[113.793,-6.882],[113.924,-6.865],[113.968,-6.871],[113.99,-6.878],[114.01,-6.887],[114.028,-6.899]],"ISL":[[[112.701,-5.726],[112.715,-5.736],[112.727,-5.747],[112.736,-5.763],[112.74,-5.787],[112.739,-5.81],[112.731,-5.828],[112.719,-5.842],[112.701,-5.849],[112.691,-5.85],[112.664,-5.848],[112.658,-5.845],[112.655,-5.837],[112.646,-5.839],[112.631,-5.849],[112.604,-5.847],[112.596,-5.836],[112.593,-5.817],[112.583,-5.794],[112.59,-5.786],[112.618,-5.763],[112.621,-5.758],[112.645,-5.732],[112.657,-5.737],[112.67,-5.733],[112.685,-5.728]],[[105.264,-6.528],[105.266,-6.553],[105.264,-6.592],[105.256,-6.628],[105.24,-6.644],[105.222,-6.649],[105.204,-6.673],[105.192,-6.679],[105.183,-6.672],[105.185,-6.655],[105.194,-6.637],[105.202,-6.623],[105.19,-6.618],[105.183,-6.608],[105.175,-6.583],[105.132,-6.627],[105.12,-6.631],[105.118,-6.612],[105.138,-6.587],[105.188,-6.548],[105.196,-6.555],[105.204,-6.545],[105.216,-6.539],[105.226,-6.536],[105.23,-6.538],[105.234,-6.532],[105.242,-6.528],[105.253,-6.527]],[[114.369,-7.09],[114.383,-7.113],[114.397,-7.131],[114.395,-7.158],[114.392,-7.179],[114.378,-7.178],[114.357,-7.167],[114.332,-7.159],[114.325,-7.148],[114.307,-7.149],[114.293,-7.143],[114.285,-7.126],[114.273,-7.101],[114.27,-7.081],[114.295,-7.055],[114.322,-7.05],[114.343,-7.056],[114.358,-7.069]],[[109.019,-7.758],[109.024,-7.762],[109.043,-7.761],[109.047,-7.768],[109.043,-7.779],[109.036,-7.78],[109.026,-7.778],[108.999,-7.773],[108.945,-7.754],[108.886,-7.744],[108.873,-7.737],[108.857,-7.732],[108.815,-7.738],[108.8,-7.734],[108.794,-7.719],[108.797,-7.702],[108.807,-7.686],[108.822,-7.679],[108.874,-7.703],[108.925,-7.71],[108.958,-7.72],[109.011,-7.75]],[[113.395,-8.447],[113.406,-8.453],[113.412,-8.467],[113.413,-8.481],[113.409,-8.487],[113.397,-8.488],[113.372,-8.495],[113.292,-8.495],[113.282,-8.488],[113.278,-8.473],[113.282,-8.457],[113.296,-8.447],[113.292,-8.44],[113.289,-8.433],[113.34,-8.444]],[[114.594,-7.131],[114.605,-7.131],[114.615,-7.132],[114.622,-7.137],[114.625,-7.148],[114.623,-7.163],[114.619,-7.167],[114.533,-7.158],[114.511,-7.159],[114.5,-7.158],[114.495,-7.155],[114.496,-7.144],[114.499,-7.138],[114.505,-7.134],[114.541,-7.119],[114.55,-7.117],[114.559,-7.119],[114.581,-7.128]],[[114.038,-7.075],[114.052,-7.083],[114.06,-7.102],[114.056,-7.113],[113.992,-7.108],[113.95,-7.092],[113.941,-7.085],[113.935,-7.074],[113.942,-7.063],[113.951,-7.059],[113.953,-7.062],[113.962,-7.067]]]};
// approximate Java coastline [lon, lat] for the mini-map
export const JAVA = [[105.85,-5.88],[106.1,-5.95],[106.4,-6.0],[106.7,-6.04],[106.95,-6.08],[107.2,-5.95],[107.6,-6.2],[108.0,-6.28],[108.3,-6.25],
  [108.6,-6.73],[109.0,-6.83],[109.5,-6.8],[110.0,-6.9],[110.45,-6.92],[110.7,-6.45],[111.1,-6.4],[111.5,-6.65],[112.0,-6.85],[112.6,-6.85],
  [112.7,-7.2],[112.8,-7.55],[113.2,-7.7],[113.8,-7.7],[114.1,-7.65],[114.45,-7.8],[114.4,-8.2],[114.6,-8.75],[114.0,-8.6],[113.5,-8.35],
  [113.0,-8.3],[112.5,-8.4],[111.7,-8.3],[111.0,-8.2],[110.5,-8.15],[110.0,-7.9],[109.4,-7.75],[108.8,-7.75],[108.3,-7.8],[107.7,-7.55],
  [107.2,-7.45],[106.5,-7.4],[106.4,-7.0],[105.8,-6.85],[105.4,-6.8],[105.25,-6.6],[105.6,-6.4]];

// ---------- elevation (m above sea level): anchor points along the roads of Java (towns, toll gates, passes), from topographic maps ----------
// altAt(lat, lon) interpolates between the nearest anchors (inverse distance), the lowlands default to ~20 m
export const ELEV_PTS = [
  // Banten, Jakarta, Bogor, Sukabumi
  [-5.93,106.0,5],[-6.0,106.05,20],[-6.12,106.15,30],[-6.31,106.1,150],[-6.36,106.25,50],[-6.18,106.63,15],[-6.3,106.67,40],[-6.47,106.47,100],[-6.99,106.55,10],
  [-6.2,106.82,8],[-6.24,106.87,25],[-6.24,107.0,20],[-6.3,107.15,25],[-6.37,106.89,70],[-6.4,106.82,80],[-6.38,106.86,90],[-6.46,106.92,120],[-6.49,106.88,140],
  [-6.55,106.85,190],[-6.6,106.8,260],[-6.66,106.85,450],[-6.75,106.8,520],[-6.89,106.78,360],[-6.92,106.93,590],[-6.70,106.99,1450],[-6.73,107.04,1100],[-6.82,107.14,450],
  // Karawang, Purwakarta, Cipularang, Bandung, Garut, Sumedang, Cirebon
  [-6.3,107.3,20],[-6.4,107.45,40],[-6.52,107.47,80],[-6.55,107.44,90],[-6.53,107.39,110],[-6.62,107.38,250],[-6.66,107.40,400],[-6.71,107.42,520],[-6.76,107.43,650],
  [-6.84,107.48,700],[-6.87,107.54,750],[-6.89,107.58,780],[-6.91,107.61,720],[-6.95,107.58,690],[-6.81,107.62,1250],[-6.94,107.75,680],[-6.93,107.77,700],
  [-7.03,107.89,850],[-7.21,107.9,720],[-7.33,108.22,350],[-7.33,108.35,230],[-7.37,108.53,50],[-6.85,107.88,600],[-6.86,107.92,460],[-6.76,108.17,60],[-6.67,108.17,40],
  [-6.83,108.23,140],[-6.57,107.76,120],[-6.98,108.48,550],[-6.72,108.55,5],[-6.45,108.2,15],[-6.33,108.32,5],[-7.1,107.3,980],[-7.2,107.05,700],
  // Central Java
  [-6.87,109.13,5],[-7.25,109.0,100],[-7.42,109.23,110],[-7.39,109.36,80],[-7.4,109.69,280],[-7.36,109.9,770],[-7.21,109.91,2000],[-7.33,110.02,1400],[-7.31,110.17,600],
  [-7.48,110.22,380],[-7.58,110.28,350],[-7.8,110.37,110],[-7.89,110.33,50],[-6.97,110.42,5],[-7.06,110.42,250],[-7.14,110.4,320],[-7.24,110.43,480],[-7.26,110.4,470],
  [-7.33,110.5,600],[-7.53,110.6,400],[-7.55,110.74,110],[-7.57,110.82,95],[-7.66,111.13,1000],[-7.81,110.92,140],[-7.7,110.6,150],[-6.92,110.2,10],[-6.89,109.67,5],
  [-6.97,110.07,20],[-6.92,109.73,10],[-7.03,109.59,100],[-6.8,110.84,20],[-6.75,111.04,15],[-6.97,111.42,70],[-7.72,109.0,5],[-7.67,109.65,20],[-7.71,110.01,60],
  [-7.2,110.15,700],[-6.98,109.95,350],
  // East Java and Madura
  [-7.4,111.45,60],[-7.63,111.52,70],[-7.65,111.33,380],[-7.67,111.22,1300],[-7.6,111.9,60],[-7.59,112.1,50],[-7.55,112.23,45],[-7.47,112.43,25],[-7.26,112.75,5],
  [-7.45,112.72,5],[-7.55,112.69,10],[-7.65,112.69,140],[-7.72,112.71,250],[-7.8,112.73,400],[-7.83,112.7,490],[-7.89,112.66,480],[-7.97,112.63,450],[-7.87,112.52,870],
  [-7.84,112.45,1100],[-7.82,112.01,70],[-7.76,112.2,100],[-8.1,112.17,160],[-8.07,111.9,85],[-8.05,111.71,60],[-7.87,111.46,100],[-7.65,112.9,5],[-7.75,113.21,5],
  [-7.88,112.91,1700],[-8.13,113.22,50],[-8.16,112.69,380],[-8.21,112.75,450],[-8.17,113.7,90],[-7.91,113.82,250],[-7.7,114.0,10],[-8.22,114.37,10],[-8.14,114.4,5],
  [-8.23,113.95,600],[-6.9,112.05,5],[-7.16,112.65,5],[-7.12,112.42,10],[-7.03,112.74,10],[-7.0,113.86,10],[-7.1,113.2,20]];
export function altAt(lat, lon){
  if (lat == null) return 20; let sw = 0, sh = 0, near = Infinity;
  const c = Math.cos(lat*Math.PI/180);
  for (const [la, lo, h] of ELEV_PTS) { const dx = (lo - lon)*c*111, dy = (la - lat)*111, d2 = dx*dx + dy*dy; near = Math.min(near, d2);
    if (d2 > 1600) continue; if (d2 < 0.01) return h; const w = 1/(d2*d2); sw += w; sh += w*h; }
  if (!sw) return 20;
  const h = sh/sw, far = Math.sqrt(near);
  return far > 25 ? 20 + (h - 20)*Math.max(0, (40 - far)/15) : h;    // far from every anchor: back towards the lowlands
}
// height (m) by corridor KM where the road's own profile is known better than the area model: the hilly toll roads
export const ALT_KM = {
  cipularang: [[66,40],[67,45],[72,60],[76,80],[80,110],[84,150],[88,240],[92,330],[95,420],[97,470],[100,560],[103,610],[106,660],[110,710],[113,680],[116,650],[118,680],[121,700]],
  padaleunyi: [[121,700],[125,720],[128,770],[131,700],[134,680],[138,670],[142,680],[147,675],[152,680],[153,690]],
  semsol: [[433,250],[436,290],[440,330],[443,390],[446,440],[450,480],[453,510],[456,540],[460,590],[464,620],[467,600],[471,560],[475,500],[480,450],[485,420],[488,330],[491,230],[495,120],[498,110]],
  gempan: [[0,10],[5,40],[9,90],[13,140],[17,250],[22,400],[26,460],[29,490],[33,500],[36,480],[42,450],[45,450]],
  jag: [[0,25],[5,45],[9,70],[14,90],[21,120],[26,140],[29,190],[35,220],[40,240],[43,260],[47,450]],
  bocimi: [[0,450],[4,500],[8,520],[12,540],[15,520],[20,450],[26,360]],
  cisumdawu: [[0,680],[6,720],[12,750],[16,620],[20,460],[24,430],[29,400],[35,280],[40,200],[45,130],[50,90],[55,60],[61,40]],
  soroja: [[0,690],[4,700],[7,720],[10,730]],
};
