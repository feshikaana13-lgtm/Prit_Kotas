import { db, KOLEKSI_KONSULTASI_DTSEN } from "./firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getCountFromServer,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { unggahKeCloudinary } from "./cloudinary-config.js";

const KOLEKSI = "pengaduan";

export const DAFTAR_KATEGORI_PENGADUAN = [
  "Masyarakat",
  "Instansi Pemerintah/Lembaga Negara",
  "Pegawai BPS",
  "Laporan Kedinasan (Pusat dan Daerah)",
  "Pelajar/Mahasiswa"
];

export const DAFTAR_MATERI_PENGADUAN = [
  "Pelanggaran Sumpah Jabatan",
  "Pelanggaran terhadap peraturan disiplin PNS",
  "Pelanggaran Hukum Pidana",
  "Mal Administrasi",
  "Pelayanan publik yang tidak memuaskan (dapat merugikan pihak-pihak yang berkepentingan)"
];

export const DETAIL_KATEGORI_PENGADUAN = [
  { value: "Masyarakat", ikon: "👥", desc: "Pelapor adalah warga masyarakat umum." },
  { value: "Instansi Pemerintah/Lembaga Negara", ikon: "🏛️", desc: "Pelapor berasal dari instansi pemerintah/lembaga negara." },
  { value: "Pegawai BPS", ikon: "👔", desc: "Pelapor adalah pegawai internal BPS." },
  { value: "Laporan Kedinasan (Pusat dan Daerah)", ikon: "📑", desc: "Laporan resmi dari unit kedinasan pusat/daerah." },
  { value: "Pelajar/Mahasiswa", ikon: "🎓", desc: "Pelapor berstatus pelajar atau mahasiswa." }
];

export const DETAIL_MATERI_PENGADUAN = [
  { value: "Pelanggaran Sumpah Jabatan", ikon: "⚖️", desc: "Pelanggaran terhadap sumpah/janji jabatan pegawai." },
  { value: "Pelanggaran terhadap peraturan disiplin PNS", ikon: "📏", desc: "Ketidakpatuhan terhadap aturan disiplin PNS." },
  { value: "Pelanggaran Hukum Pidana", ikon: "🚨", desc: "Dugaan tindak pidana yang melibatkan pegawai BPS." },
  { value: "Mal Administrasi", ikon: "📋", desc: "Penyimpangan prosedur administrasi." },
  { value: "Pelayanan publik yang tidak memuaskan (dapat merugikan pihak-pihak yang berkepentingan)", ikon: "😞", desc: "Layanan yang merugikan pihak berkepentingan." }
];

export const LABEL_STATUS = {
  menunggu: "Menunggu",
  diproses: "Diproses",
  selesai: "Selesai"
};

async function unggahBuktiPengaduan(fileList) {
  const hasil = [];
  const files = Array.from(fileList || []);
  const folder = `bukti-pengaduan/${new Date().toISOString().slice(0, 10)}`;
  for (const file of files) {
    const url = await unggahKeCloudinary(file, folder);
    hasil.push({ nama: file.name, url });
  }
  return hasil;
}

export async function ambilNomorAntrianBerikutnya(koleksi = KOLEKSI) {
  const snap = await getCountFromServer(collection(db, koleksi));
  return snap.data().count + 1;
}

export async function ajukanPengaduanPublik(data, fileList) {
  const bukti = await unggahBuktiPengaduan(fileList);
  const nomorAntrian = await ambilNomorAntrianBerikutnya();

  await addDoc(collection(db, KOLEKSI), {
    ...data,
    email: data.email.trim().toLowerCase(),
    bukti,
    nomorAntrian,
    status: "menunggu",
    tanggapan: "",
    sumberInput: "publik",
    diinputOleh: null,
    dibuatPada: new Date().toISOString(),
    diperbaruiPada: new Date().toISOString()
  });

  return nomorAntrian;
}

export async function inputPengaduanManual(data, fileList, namaStaf) {
  const bukti = await unggahBuktiPengaduan(fileList);
  const { status, ...dataLain } = data;
  const nomorAntrian = await ambilNomorAntrianBerikutnya(KOLEKSI_KONSULTASI_DTSEN);

  await addDoc(collection(db, KOLEKSI_KONSULTASI_DTSEN), {
    ...dataLain,
    email: dataLain.email.trim().toLowerCase(),
    bukti,
    nomorAntrian,
    status: status || "menunggu",
    tanggapan: "",
    sumberInput: "manual-admin",
    diinputOleh: namaStaf,
    dibuatPada: new Date().toISOString(),
    diperbaruiPada: new Date().toISOString()
  });

  return nomorAntrian;
}

const KOLEKSI_GRATIFIKASI = "gratifikasi";

export async function ajukanLaporanGratifikasi(data, fileList, namaStaf) {
  const foto = await unggahBuktiPengaduan(fileList);

  await addDoc(collection(db, KOLEKSI_GRATIFIKASI), {
    kodeUnik: `BPS-GRAT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    namaPemberi: data.namaPemberi,
    instansiPemberi: data.instansiPemberi,
    bentukPemberian: data.bentukPemberian,
    alasanPenerimaan: data.alasanPenerimaan,
    alasanDiterima: data.alasanPenerimaan,
    tindakLanjutBarang: data.tindakLanjutBarang,
    foto,
    fotoBarang: foto,
    diinputOleh: namaStaf,
    status: "Tercatat",
    sumber: "Manual",
    tanggal: new Date().toISOString(),
    timestamp: new Date().toISOString()
  });
}

export function pantauSemuaGratifikasi(callback) {
  const q = query(collection(db, KOLEKSI_GRATIFIKASI), orderBy("timestamp", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
}

const KOLEKSI_MASUKAN = "saran";

export async function kirimSaran(pesan) {
  await addDoc(collection(db, KOLEKSI_MASUKAN), {
    pesan,
    dibuatPada: new Date().toISOString()
  });
}

export function pantauSemuaSaran(callback) {
  const q = query(collection(db, KOLEKSI_MASUKAN), orderBy("dibuatPada", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
}

export async function cariPengaduanByEmail(email) {
  const q = query(
    collection(db, KOLEKSI),
    where("email", "==", email.trim().toLowerCase()),
    orderBy("dibuatPada", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function pantauSemuaPengaduan(callback) {
  const q = query(collection(db, KOLEKSI), orderBy("dibuatPada", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
}

export async function updateStatusPengaduan(id, status, tanggapan) {
  return updateDoc(doc(db, KOLEKSI, id), {
    status,
    tanggapan: tanggapan || "",
    diperbaruiPada: new Date().toISOString()
  });
}
