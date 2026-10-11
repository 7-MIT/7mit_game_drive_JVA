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
  C('japek', 'Tol Jakarta–Cikampek', 'Jakarta–Cikampek', 4, 100, [
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
  C('padaleunyi', 'Tol Padaleunyi', 'Padaleunyi', 3, 80, [
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
const edgeOK = (e, mode) => !(mode === 'toll' && e.cls === 'n') && !(mode === 'nr' && e.cls === 't');
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

// approximate Java coastline [lon, lat] for the mini-map
export const JAVA = [[105.85,-5.88],[106.1,-5.95],[106.4,-6.0],[106.7,-6.04],[106.95,-6.08],[107.2,-5.95],[107.6,-6.2],[108.0,-6.28],[108.3,-6.25],
  [108.6,-6.73],[109.0,-6.83],[109.5,-6.8],[110.0,-6.9],[110.45,-6.92],[110.7,-6.45],[111.1,-6.4],[111.5,-6.65],[112.0,-6.85],[112.6,-6.85],
  [112.7,-7.2],[112.8,-7.55],[113.2,-7.7],[113.8,-7.7],[114.1,-7.65],[114.45,-7.8],[114.4,-8.2],[114.6,-8.75],[114.0,-8.6],[113.5,-8.35],
  [113.0,-8.3],[112.5,-8.4],[111.7,-8.3],[111.0,-8.2],[110.5,-8.15],[110.0,-7.9],[109.4,-7.75],[108.8,-7.75],[108.3,-7.8],[107.7,-7.55],
  [107.2,-7.45],[106.5,-7.4],[106.4,-7.0],[105.8,-6.85],[105.4,-6.8],[105.25,-6.6],[105.6,-6.4]];
