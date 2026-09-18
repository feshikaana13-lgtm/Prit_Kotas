import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { auth, db, KOLEKSI_KONSULTASI_DTSEN } from "./firebase-config.js";
import { unggahKeCloudinary } from "./cloudinary-config.js";

function pesanKesalahanPengiriman(error, jenisData) {
  if (error?.code === "permission-denied") {
    return `Firestore menolak penyimpanan ${jenisData}. Pastikan Rules sudah dipublish dan akun staf memiliki role "staf".`;
  }
  if (error?.code === "failed-precondition") {
    return `Konfigurasi Firestore belum siap untuk ${jenisData}. Periksa Rules dan indeks Firebase.`;
  }
  if (error?.message?.includes("Cloudinary")) {
    return `Bukti gagal diunggah: ${error.message}`;
  }
  return `Gagal menyimpan ${jenisData}. Periksa koneksi internet lalu coba lagi.`;
}

window.selectCard = function (element, groupName) {
  if (!element) return;
  const cards = document.querySelectorAll(`input[name="${groupName}"]`);
  cards.forEach((radio) => {
    const cardEl = radio.closest(".category-card, .select-card");
    if (cardEl) cardEl.classList.remove("selected");
  });
  element.classList.add("selected");
  const radio = element.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;
};

function showToast(message, type = "success") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === "success" ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>'}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
window.showToast = showToast;

function formatTanggal(iso) {
  if (!iso) return "Baru saja";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak valid";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeStatus(status) {
  const normalized = String(status || "menunggu").toLowerCase();
  if (normalized === "diproses") return "Diproses";
  if (normalized === "selesai") return "Selesai";
  return "Menunggu";
}

function normalizeReport(id, data) {
  return {
    id,
    ...data,
    status: normalizeStatus(data.status),
    tanggal: data.tanggal || data.dibuatPada || data.timestamp || "",
    tanggapan: data.tanggapan || "",
    bukti: data.bukti || data.foto || data.fotoBarang || []
  };
}

function normalizeGratifikasi(id, data) {
  return {
    id,
    ...data,
    alasanDiterima: data.alasanDiterima || data.alasanPenerimaan || "",
    tindakLanjutBarang: data.tindakLanjutBarang || "",
    fotoBarang: data.fotoBarang || data.foto || [],
    tanggal: data.tanggal || data.timestamp || ""
  };
}

function generateKode(prefix) {
  return prefix + "-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function unggahSatuFile(file, folder) {
  return unggahKeCloudinary(file, folder);
}

function initScrollReveal() {
  const revealEls = document.querySelectorAll(".reveal, .reveal-stagger");
  if (!revealEls.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealEls.forEach((el) => observer.observe(el));
}

function initPengaduanPage() {
  const form = document.getElementById("pengaduanForm");
    const errorAlert = document.getElementById("errorAlert");
  const successCard = document.getElementById("successCard");
  const consentCheckbox = document.getElementById("consentCheck");
  const fieldsWrapper = document.getElementById("formFieldsWrapper");
  const btn = document.getElementById("btnKirim");
  if (!form) return;

  const gatedFields = fieldsWrapper
    ? fieldsWrapper.querySelectorAll("input, textarea, select")
    : [];

  function updateFormGate() {
    const isChecked = !!consentCheckbox?.checked;
    gatedFields.forEach((el) => { el.disabled = !isChecked; });
    if (fieldsWrapper) fieldsWrapper.classList.toggle("fields-locked", !isChecked);
    if (btn) btn.disabled = !isChecked;
  }

  if (consentCheckbox) {
    consentCheckbox.addEventListener("change", updateFormGate);
    updateFormGate();
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (errorAlert) errorAlert.style.display = "none";

    if (consentCheckbox && !consentCheckbox.checked) {
      if (errorAlert) {
        errorAlert.style.display = "block";
        errorAlert.textContent = "Mohon centang persetujuan bahwa Anda telah membaca hak-hak pelapor.";
      }
      consentCheckbox.closest(".consent-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (btn) {
      btn.innerHTML = '<span class="spinner"></span> Mengirim Pengaduan...';
      btn.disabled = true;
    }

    const namaPelapor = document.getElementById("nama")?.value.trim() || "";
    const tanggalPengaduan = document.getElementById("tanggalPengaduan")?.value || "";
    const emailPelapor = document.getElementById("email")?.value.trim().toLowerCase() || "";
    const teleponPelapor = document.getElementById("telepon")?.value.trim() || "";
    const kategoriEl = document.querySelector('input[name="kategori"]:checked');
    const materiEl = document.querySelector('input[name="materi"]:checked');
    const isiLaporan = document.getElementById("isi_laporan")?.value.trim() || "";
    const saran = document.getElementById("saran_pengaduan")?.value.trim() || "";

    if (!tanggalPengaduan || !kategoriEl || !materiEl) {
      if (errorAlert) {
        errorAlert.style.display = "block";
        errorAlert.textContent = "Mohon lengkapi tanggal, kategori pelapor, dan materi pengaduan.";
      }
      if (btn) {
        btn.textContent = "Kirim Pengaduan";
        btn.disabled = false;
      }
      return;
    }

    try {
      const lampiranInput = document.getElementById("lampiran");
      const files = lampiranInput?.files ? Array.from(lampiranInput.files) : [];
      const MAX_FILE_SIZE = 10 * 1024 * 1024;

      const fileTooLarge = files.some((file) => file.size > MAX_FILE_SIZE);
      if (fileTooLarge) {
        if (errorAlert) {
          errorAlert.style.display = "block";
          errorAlert.textContent = "Ukuran file tidak boleh melebihi 10 MB. Silakan kompres atau pilih file yang lebih kecil.";
        }
        if (btn) {
          btn.textContent = "Kirim Pengaduan";
          btn.disabled = false;
        }
        return;
      }

      const uploadedUrls = [];
      for (const file of files) {
        const url = await unggahKeCloudinary(file, "bukti-pengaduan");
        uploadedUrls.push({ nama: file.name, url: url });
      }
      if (files.length !== uploadedUrls.length) {
        throw new Error("Sebagian bukti gagal diunggah sehingga laporan tidak disimpan.");
      }

      const uniqueCode = generateKode("BPS");
      await addDoc(collection(db, "pengaduan"), {
        kodeUnik: uniqueCode,
        nama: namaPelapor,
        email: emailPelapor,
        telepon: teleponPelapor,
        kategori: kategoriEl.value,
        materi: materiEl.value,
        laporan: isiLaporan,
        saran: saran,
        bukti: uploadedUrls,
        status: "Menunggu",
        sumber: "Publik",
        tanggal: tanggalPengaduan,
        tanggalPengaduan,
        dibuatPada: new Date().toISOString(),
        tanggapan: "Laporan Anda telah kami terima dan berada dalam antrean verifikasi awal oleh tim pemeriksa."
      });

      form.style.display = "none";
      if (successCard) successCard.style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Gagal menyimpan data ke Firebase: ", error);
      if (errorAlert) {
        errorAlert.style.display = "block";
        errorAlert.textContent = pesanKesalahanPengiriman(error, "pengaduan");
      }
      if (btn) {
        btn.textContent = "Kirim Pengaduan";
        btn.disabled = false;
      }
    }
  });

  const miniSaranForm = document.getElementById("miniSaranForm");
  if (miniSaranForm) {
    miniSaranForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const btnMini = document.getElementById("btnKirimMiniSaran");
      const textEl = document.getElementById("miniSaranText");
      const text = textEl?.value.trim() || "";
      if (!text) return;

      if (btnMini) {
        btnMini.textContent = "Mengirim...";
        btnMini.disabled = true;
      }

      try {
        await addDoc(collection(db, "saran"), {
          nama: "Anonim (via form pengaduan)",
          email: "",
          telepon: "",
          kategori: "Umum",
          judul: "Masukan singkat dari halaman pengaduan",
          isi: text,
          tanggal: new Date().toISOString()
        });
        textEl.value = "";
        showToast("Terima kasih, masukan Anda telah terkirim.");
      } catch (error) {
        console.error("Gagal mengirim saran singkat:", error);
        showToast("Gagal mengirim masukan, coba lagi.", "error");
      } finally {
        if (btnMini) {
          btnMini.textContent = "Kirim Saran";
          btnMini.disabled = false;
        }
      }
    });
  }
}

function initSaranPage() {
  const form = document.getElementById("saranForm");
  const errorAlert = document.getElementById("saranErrorAlert");
  const successCard = document.getElementById("saranSuccessCard");
  if (!form) return;

  const dropzone = document.getElementById("dropzoneSaran");
  const fileInput = document.getElementById("lampiranSaran");
  const fileLabel = document.getElementById("dropzoneSaranLabel");
  const MAX_FILES = 10;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  function updateSaranDropzoneLabel() {
    if (!fileLabel || !fileInput?.files.length) return;
    fileLabel.textContent = `${fileInput.files.length} file dipilih`;
  }

  function validateSaranFiles(files) {
    if (files.length > MAX_FILES) {
      showToast(`Maksimal ${MAX_FILES} file yang dapat diunggah.`, "error");
      return false;
    }
    const fileTooLarge = files.some((file) => file.size > MAX_FILE_SIZE);
    if (fileTooLarge) {
      showToast("Ukuran setiap berkas maksimal 10 MB.", "error");
      return false;
    }
    return true;
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "var(--merah-utama)";
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.style.borderColor = "";
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "";
      const files = Array.from(e.dataTransfer.files);
      if (validateSaranFiles(files)) {
        fileInput.files = e.dataTransfer.files;
        updateSaranDropzoneLabel();
      }
    });
    fileInput.addEventListener("change", () => {
      const files = Array.from(fileInput.files);
      if (!validateSaranFiles(files)) {
        fileInput.value = "";
        if (fileLabel) fileLabel.innerHTML = "<strong>Unggah berkas pendukung</strong> atau seret ke sini";
        return;
      }
      updateSaranDropzoneLabel();
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const btn = document.getElementById("btnKirimSaran");
    if (errorAlert) errorAlert.style.display = "none";

    const nama = document.getElementById("saranNama")?.value.trim() || "";
    const tanggalSaran = document.getElementById("tanggalSaran")?.value || "";
    const email = document.getElementById("saranEmail")?.value.trim().toLowerCase() || "";
    const telepon = document.getElementById("saranTelepon")?.value.trim() || "";
    const kategoriEl = document.querySelector('input[name="kategoriSaran"]:checked');
    const judul = document.getElementById("saranJudul")?.value.trim() || "";
    const isi = document.getElementById("saranIsi")?.value.trim() || "";
    const files = fileInput?.files ? Array.from(fileInput.files) : [];

    if (!tanggalSaran || !kategoriEl) {
      if (errorAlert) {
        errorAlert.style.display = "block";
        errorAlert.textContent = "Mohon lengkapi tanggal penyampaian dan kategori saran.";
      }
      return;
    }

    if (btn) {
      btn.innerHTML = '<span class="spinner"></span> Mengirim Saran...';
      btn.disabled = true;
    }

    try {
      const lampiran = [];
      for (const file of files) {
        const url = await unggahKeCloudinary(file, "bukti-saran");
        lampiran.push({ nama: file.name, url });
      }

      await addDoc(collection(db, "saran"), {
        nama,
        email,
        telepon,
        kategori: kategoriEl.value,
        judul,
        isi,
        lampiran,
        tanggal: tanggalSaran,
        tanggalSaran,
        dibuatPada: new Date().toISOString()
      });

      form.style.display = "none";
      if (successCard) successCard.style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Gagal mengirim saran:", error);
      if (errorAlert) {
        errorAlert.style.display = "block";
        errorAlert.textContent = pesanKesalahanPengiriman(error, "KoSan");
      }
    } finally {
      if (btn) {
        btn.textContent = "Kirim Saran";
        btn.disabled = false;
      }
    }
  });
}

function initCekStatusPage() {
  const form = document.getElementById("cekStatusForm");
    const searchBoxWrapper = document.getElementById("searchBoxWrapper");
  const resultContainer = document.getElementById("resultContainer");
  const listHasilLaporan = document.getElementById("listHasilLaporan");
  const btnCari = document.getElementById("btnCari");
  if (!form) return;

  function buildStepper(status) {
    const steps = ["Menunggu", "Diproses", "Selesai"];
    const icons = { Menunggu: '<i class="fa-solid fa-hourglass-half"></i>', Diproses: '<i class="fa-solid fa-arrows-rotate"></i>', Selesai: '<i class="fa-solid fa-check"></i>' };
    const idx = Math.max(steps.indexOf(status), 0);
    const fillPercent = idx === 0 ? 0 : idx === 1 ? 42 : 84;

    let html = `<div class="status-stepper"><div class="step-fill" style="width:${fillPercent}%"></div>`;
    steps.forEach((s, i) => {
      let cls = "";
      if (i < idx) cls = "done";
      else if (i === idx) cls = "current";
      const icon = i < idx ? '<i class="fa-solid fa-check"></i>' : icons[s];
      html += `
        <div class="step ${cls}">
          <div class="step-icon">${icon}</div>
          <div class="step-label">${s}</div>
        </div>`;
    });
    html += `</div>`;
    return html;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const searchEmailInput = document.getElementById("searchEmail");
    const emailInput = searchEmailInput ? searchEmailInput.value.trim().toLowerCase() : "";

    if (btnCari) {
      btnCari.innerHTML = '<span class="spinner"></span> Mencari Data...';
      btnCari.disabled = true;
    }

    try {
      const querySnapshot = await getDocs(query(collection(db, "pengaduan"), where("email", "==", emailInput)));

      if (listHasilLaporan) {
        listHasilLaporan.innerHTML = "";

        if (querySnapshot.empty) {
          listHasilLaporan.innerHTML = `
            <div class="result-card" style="text-align: center; padding: 2.5rem;">
              <p style="color: var(--teks-muted); font-size: 0.95rem; margin: 0;">Tidak ditemukan riwayat pengaduan dengan email: <strong>${escapeHTML(emailInput)}</strong>.</p>
            </div>`;
        } else {
          querySnapshot.forEach((docSnap) => {
            const data = normalizeReport(docSnap.id, docSnap.data());
            let badgeClass = "badge-pending";
            if (data.status === "Selesai") badgeClass = "badge-sukses";
            else if (data.status === "Diproses") badgeClass = "badge-proses";

            const displayMateri = data.materi ? ` - ${data.materi}` : "";
            const tglFormatted = formatTanggal(data.tanggal);

            listHasilLaporan.innerHTML += `
              <div class="result-card">
                <div class="result-header">
                  <div>
                    <span style="font-size: 0.8rem; color: var(--teks-muted); display: block;">KODE TIKET: <strong>${escapeHTML(data.kodeUnik || docSnap.id.substring(0, 8))}</strong> • Dikirim ${escapeHTML(tglFormatted)}</span>
                    <strong style="color: var(--merah-gelap); font-size: 1.05rem;">${escapeHTML(data.kategori || "Pengaduan")}${escapeHTML(displayMateri)}</strong>
                  </div>
                  <span class="badge ${badgeClass}">${escapeHTML(data.status)}</span>
                </div>
                ${buildStepper(data.status || "Menunggu")}
                <div style="margin-bottom: 1.2rem;">
                  <span style="font-size: 0.8rem; color: var(--teks-muted); display: block;">URAIAN LAPORAN</span>
                  <p style="color: var(--teks-gelap); font-size: 0.95rem; margin: 0.3rem 0 0 0; line-height: 1.5;">${escapeHTML(data.laporan || "-")}</p>
                </div>
                ${data.saran ? `<div style="margin-bottom: 1.2rem;"><span style="font-size:0.8rem;color:var(--teks-muted);display:block;">SARAN ANDA</span><p style="color:var(--teks-gelap);font-size:0.95rem;">${escapeHTML(data.saran)}</p></div>` : ""}
                <div class="result-response-box">
                  <strong style="font-size: 0.85rem; color: var(--merah-gelap); display: block; margin-bottom: 0.2rem;">Tanggapan / Progres Terbaru:</strong>
                  <span style="font-size: 0.9rem; color: var(--teks-gelap);">${escapeHTML(data.tanggapan || "Menunggu verifikasi lanjutan dari petugas.")}</span>
                </div>
              </div>`;
          });
        }
      }

      if (searchBoxWrapper) searchBoxWrapper.style.display = "none";
      if (resultContainer) resultContainer.style.display = "block";
    } catch (error) {
      console.error("Gagal mengambil data: ", error);
      showToast("Terjadi kendala koneksi saat memuat data riwayat laporan.", "error");
    } finally {
      if (btnCari) {
        btnCari.textContent = "Cek Status Laporan";
        btnCari.disabled = false;
      }
    }
  });

  window.resetPencarian = function () {
    if (resultContainer) resultContainer.style.display = "none";
    if (searchBoxWrapper) searchBoxWrapper.style.display = "block";
    const emailEl = document.getElementById("searchEmail");
    if (emailEl) emailEl.value = "";
  };
}

function initLoginPage() {
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const btnLogin = document.getElementById("btnLogin");
  if (!loginForm) return;

  const togglePassBtn = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("adminPassword");
  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener("click", function () {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      togglePassBtn.classList.toggle("is-visible", isHidden);
      togglePassBtn.setAttribute("aria-label", isHidden ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
    });
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("adminEmail")?.value.trim() || "";
    const password = document.getElementById("adminPassword")?.value || "";

    if (btnLogin) {
      btnLogin.innerHTML = '<span class="spinner"></span> Memverifikasi...';
      btnLogin.disabled = true;
    }
    if (loginError) loginError.style.display = "none";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard-staf.html";
    } catch (error) {
      console.error("Gagal login: ", error);
      if (loginError) {
        loginError.style.display = "block";
        loginError.textContent = "Autentikasi gagal. Periksa kembali email dan sandi Anda.";
      }
      if (btnLogin) {
        btnLogin.textContent = "Masuk Sistem";
        btnLogin.disabled = false;
      }
    }
  });
}

let ALL_REPORTS = [];
let ALL_SARAN = [];
let ALL_GRATIFIKASI = [];
let ALL_OFFLINE = [];
let CURRENT_FILTER = "Semua";
let CURRENT_SEARCH = "";
let ID_LAPORAN_AKTIF = null;

function initDashboardPage() {
  const tbody = document.getElementById("reportListBody");
  const btnLogout = document.getElementById("btnLogout");
  if (!tbody && !btnLogout) return;

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    loadAllData();
  });

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      signOut(auth)
        .then(() => (window.location.href = "login.html"))
        .catch((error) => console.error("Gagal keluar: ", error));
    });
  }

  const filterTabs = document.querySelectorAll(".filter-tab");
  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      filterTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      CURRENT_FILTER = tab.dataset.filter;
      renderReportList();
    });
  });

  const searchInput = document.getElementById("searchReport");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      CURRENT_SEARCH = e.target.value.trim().toLowerCase();
      renderReportList();
    });
  }

  document.querySelectorAll(".category-panel-header").forEach((header) => {
    header.addEventListener("click", () => {
      const body = header.nextElementSibling;
      body.classList.toggle("open");
      const icon = header.querySelector(".chev");
      icon.classList.toggle("open");
    });
  });

  const modal = document.getElementById("modalTanggapan");
  const btnTutupModal = document.getElementById("btnTutupModal");
  const btnBatalModal = document.getElementById("btnBatalModal");
  const btnSimpanTanggapan = document.getElementById("btnSimpanTanggapanModal");
  const textareaTanggapan = document.getElementById("textareaTanggapan");

  if (modal) {
    btnTutupModal.addEventListener("click", () => modal.classList.remove("show"));
    btnBatalModal.addEventListener("click", () => modal.classList.remove("show"));
    btnSimpanTanggapan.addEventListener("click", async () => {
      const tanggapanBaru = textareaTanggapan.value.trim();
      if (!ID_LAPORAN_AKTIF) return;
      try {
        await updateDoc(doc(db, "pengaduan", ID_LAPORAN_AKTIF), { tanggapan: tanggapanBaru });
        showToast("Tanggapan berhasil disimpan.");
        modal.classList.remove("show");
        await loadAllData();
      } catch (error) {
        console.error("Gagal menyimpan tanggapan:", error);
        showToast("Gagal menyimpan tanggapan.", "error");
      }
    });
  }

  async function loadAllData() {
    try {
      const [pengaduanSnap, saranSnap, gratifikasiSnap, dtsenSnap] = await Promise.all([
        getDocs(collection(db, "pengaduan")),
        getDocs(collection(db, "saran")),
        getDocs(collection(db, "gratifikasi")),
        getDocs(collection(db, KOLEKSI_KONSULTASI_DTSEN))
      ]);

      ALL_REPORTS = [];
      ALL_SARAN = [];
      ALL_GRATIFIKASI = [];
      ALL_OFFLINE = [];

      pengaduanSnap.forEach((doc) => {
        const data = normalizeReport(doc.id, doc.data());
        if (data.sumber === "Offline" || data.sumberInput === "manual-admin") {
          ALL_OFFLINE.push(data);
        } else {
          ALL_REPORTS.push(data);
        }
      });
      dtsenSnap.forEach((doc) => ALL_OFFLINE.push(normalizeReport(doc.id, doc.data())));
      saranSnap.forEach((doc) => ALL_SARAN.push({ id: doc.id, ...doc.data() }));
      ALL_SARAN.sort((a, b) => {
        const tanggalA = a.tanggal ? new Date(a.tanggal).getTime() : 0;
        const tanggalB = b.tanggal ? new Date(b.tanggal).getTime() : 0;
        return tanggalB - tanggalA;
      });
      gratifikasiSnap.forEach((doc) => ALL_GRATIFIKASI.push(normalizeGratifikasi(doc.id, doc.data())));

      renderPengaduanTable();
      renderSaranTable();
      renderGratifikasiTable();
      renderOfflineTable();

      updateStatCards();
      renderTrendChart();
      renderCategoryStats();
    } catch (error) {
      console.error("Gagal memuat data:", error);
    }
  }

  function updateStatCards() {
    const pending = ALL_REPORTS.filter((r) => r.status === "Menunggu").length;
    const process = ALL_REPORTS.filter((r) => r.status === "Diproses").length;
    const done = ALL_REPORTS.filter((r) => r.status === "Selesai").length;

    const elPending = document.getElementById("pendingCount");
    const elProcess = document.getElementById("processCount");
    const elDone = document.getElementById("doneCount");
    if (elPending) elPending.textContent = pending;
    if (elProcess) elProcess.textContent = process;
    if (elDone) elDone.textContent = done;
  }

  function renderTrendChart() {
    const chartWrap = document.getElementById("trendChart");
    const labelsWrap = document.getElementById("trendChartLabels");
    if (!chartWrap) return;

    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("id-ID", { month: "short" }) });
    }

    const masukPerBulan = months.map(() => 0);
    const prosesPerBulan = months.map(() => 0);
    const selesaiPerBulan = months.map((m) => 0);

    const semuaLaporan = ALL_REPORTS;
    semuaLaporan.forEach((r) => {
      if (!r.tanggal) return;
      const d = new Date(r.tanggal);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const idx = months.findIndex((m) => m.key === key);
      if (idx !== -1) {
        masukPerBulan[idx]++;
        if (normalizeStatus(r.status) === "Diproses") prosesPerBulan[idx]++;
        if (normalizeStatus(r.status) === "Selesai") selesaiPerBulan[idx]++;
      }
    });

    const maxVal = Math.max(...masukPerBulan, ...prosesPerBulan, ...selesaiPerBulan, 1);

    chartWrap.innerHTML = months
      .map((m, i) => {
        const hMasuk = Math.max(4, Math.round((masukPerBulan[i] / maxVal) * 150));
        const hProses = Math.max(4, Math.round((prosesPerBulan[i] / maxVal) * 150));
        const hSelesai = Math.max(4, Math.round((selesaiPerBulan[i] / maxVal) * 150));
        return `
          <div class="bar-group" title="${m.label}: ${masukPerBulan[i]} masuk, ${prosesPerBulan[i]} diproses, ${selesaiPerBulan[i]} selesai">
            <div class="bar masuk" style="height:${hMasuk}px; background: var(--merah-gelap);"></div>
            <div class="bar proses" style="height:${hProses}px; background: var(--jingga-proses);"></div>
            <div class="bar selesai" style="height:${hSelesai}px; background: var(--hijau-sukses);"></div>
          </div>`;
      })
      .join("");

    if (labelsWrap) {
      labelsWrap.innerHTML = months.map((m) => `<span>${m.label}</span>`).join("");
    }
  }

  function renderCategoryStats() {
    const wrap = document.getElementById("categoryStats");
    if (!wrap) return;

    const total = ALL_REPORTS.length + ALL_OFFLINE.length + ALL_GRATIFIKASI.length + ALL_SARAN.length;
    if (total === 0) {
      wrap.innerHTML = `<p style="color:var(--teks-muted);font-size:0.85rem;">Belum ada data statistik.</p>`;
      return;
    }

    const counts = [
      { label: "Pengaduan Masyarakat", count: ALL_REPORTS.length, color: "#e74c3c" },
      { label: "Konsultasi DTSEN", count: ALL_OFFLINE.length, color: "#3498db" },
      { label: "Antigratifikasi", count: ALL_GRATIFIKASI.length, color: "#f39c12" },
      { label: "KoSan(Kotak Saran)", count: ALL_SARAN.length, color: "#2ecc71" }
    ];

    wrap.innerHTML = counts.map((c) => {
      const pct = Math.round((c.count / total) * 100);
      return `
        <div class="stat-item">
          <div class="stat-label"><span>${c.label}</span><span>${pct}%</span></div>
          <div class="progress-track" style="background: #eee; height: 10px; border-radius: 5px; overflow: hidden;">
            <div class="progress-fill" style="height: 100%; width: ${pct}%; background: ${c.color}; border-radius: 5px;"></div>
          </div>
        </div>`;
    }).join("");
  }

  function renderPengaduanTable() {
    const tbody = document.getElementById("pengaduanTableBody");
    if (!tbody) return;
    const filtered = ALL_REPORTS.filter((r) => {
      const status = normalizeStatus(r.status);
      const matchFilter = CURRENT_FILTER === "Semua" || status === CURRENT_FILTER;
      const haystack = `${r.nama || ""} ${r.email || ""} ${r.kodeUnik || ""}`.toLowerCase();
      const matchSearch = !CURRENT_SEARCH || haystack.includes(CURRENT_SEARCH);
      return matchFilter && matchSearch;
    });

    tbody.innerHTML = filtered.map((r, index) => {
      const thumbnails = (r.bukti || []).map((b) => {
        const url = escapeHTML(b.url || "");
        return `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="Bukti" class="table-thumb"></a>`;
      }).join(" ");
      const statusOptions = ["Menunggu", "Diproses", "Selesai"].map(s => `<option value="${s}" ${r.status === s ? "selected" : ""}>${s}</option>`).join("");
      const tanggapanSingkat = r.tanggapan ? r.tanggapan.substring(0, 50) + (r.tanggapan.length > 50 ? "..." : "") : "Belum ada";
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHTML(r.nama || "-")}</td>
          <td>${escapeHTML(r.email || "-")}</td>
          <td>${escapeHTML(r.kategori || "-")}</td>
          <td>${escapeHTML(r.materi || "-")}</td>
          <td>${escapeHTML(r.laporan || "-")}</td>
          <td>${escapeHTML(r.saran || "-")}</td>
          <td>${formatTanggal(r.tanggal)}</td>
          <td>
            <select class="status-select" data-id="${r.id}">
              ${statusOptions}
            </select>
          </td>
          <td>${thumbnails}</td>
          <td>${escapeHTML(tanggapanSingkat)}</td>
          <td>
            <button class="btn-tanggapi" data-id="${r.id}">Tanggapi</button>
          </td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll(".status-select").forEach(sel => {
      sel.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        try {
          await updateDoc(doc(db, "pengaduan", id), { status: newStatus });
          showToast("Status berhasil diperbarui.");
          await loadAllData();
        } catch (error) {
          console.error("Gagal mengubah status:", error);
          showToast("Gagal mengubah status.", "error");
        }
      });
    });

    tbody.querySelectorAll(".btn-tanggapi").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const report = ALL_REPORTS.find(r => r.id === id);
        if (report) {
          ID_LAPORAN_AKTIF = id;
          document.getElementById("textareaTanggapan").value = report.tanggapan || "";
          document.getElementById("modalTanggapan").classList.add("show");
        }
      });
    });
  }

  function renderSaranTable() {
    const tbody = document.getElementById("saranTableBody");
    if (!tbody) return;
    tbody.innerHTML = ALL_SARAN.map((s, index) => {
      const lampiran = Array.isArray(s.lampiran) ? s.lampiran : [];
      const lampiranLinks = lampiran
        .filter((file) => file?.url)
        .map((file, index) => {
          const url = escapeHTML(file.url);
          const nama = escapeHTML(file.nama || `Berkas ${index + 1}`);
          return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="file-link">${nama}</a>`;
        })
        .join("<br>");

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHTML(s.nama || "-")}</td>
          <td>${escapeHTML(s.email || "-")}</td>
          <td>${escapeHTML(s.telepon || "-")}</td>
          <td>${escapeHTML(s.kategori || "-")}</td>
          <td>${escapeHTML(s.judul || "-")}</td>
          <td>${escapeHTML(s.isi || "-")}</td>
          <td>${lampiranLinks || "-"}</td>
          <td>${formatTanggal(s.tanggal)}</td>
        </tr>
      `;
    }).join("");
  }

  function renderGratifikasiTable() {
    const tbody = document.getElementById("gratifikasiTableBody");
    if (!tbody) return;
    tbody.innerHTML = ALL_GRATIFIKASI.map((g, index) => {
      const fotos = (g.fotoBarang || []).map((f) => {
        const url = escapeHTML(f.url || "");
        return `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="Foto" class="table-thumb"></a>`;
      }).join(" ");
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHTML(g.namaPemberi || "-")}</td>
          <td>${escapeHTML(g.instansiPemberi || "-")}</td>
          <td>${escapeHTML(g.bentukPemberian ? g.bentukPemberian.join(", ") : "-")}</td>
          <td>${escapeHTML(g.tindakLanjutBarang || "-")}</td>
          <td>${escapeHTML(g.alasanDiterima || "-")}</td>
          <td>${fotos}</td>
          <td>${formatTanggal(g.tanggal)}</td>
        </tr>`;
    }).join("");
  }

  function renderOfflineTable() {
    const tbody = document.getElementById("offlineTableBody");
    if (!tbody) return;
    tbody.innerHTML = ALL_OFFLINE.map((o, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(o.nama || "-")}</td>
        <td>${escapeHTML(o.alamat || "-")}</td>
        <td>${escapeHTML(o.telepon || "-")}</td>
        <td>${escapeHTML(o.materiPengaduan || o.materi || "-")}</td>
        <td>${escapeHTML(o.jawabanPetugas || o.tanggapan || "-")}</td>
        <td>${escapeHTML(o.namaPetugas || o.diinputOleh || "-")}</td>
        <td><a href="${escapeHTML(o.dokumentasiUrl || "")}" target="_blank" rel="noopener noreferrer"><img src="${escapeHTML(o.dokumentasiUrl || "")}" alt="Dokumentasi" class="table-thumb"></a></td>
        <td>${formatTanggal(o.tanggalPengaduan || o.tanggal)}</td>
      </tr>
    `).join("");
  }

  window.exportTable = function (tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = table.querySelectorAll("tr");
    const csv = [];
    rows.forEach((row) => {
      const cols = row.querySelectorAll("td, th");
      const rowData = [];
      cols.forEach((col) => {
        rowData.push('"' + col.innerText.replace(/"/g, '""') + '"');
      });
      csv.push(rowData.join(","));
    });
    const csvContent = "\uFEFF" + csv.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  window.exportPDF = function (tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const headers = [];
    const rows = [];

    const ths = table.querySelectorAll("thead th");
    ths.forEach((th) => headers.push(th.innerText.trim()));

    const trs = table.querySelectorAll("tbody tr");
    trs.forEach((tr) => {
      const row = [];
      const tds = tr.querySelectorAll("td");
      tds.forEach((td) => row.push(td.innerText.trim()));
      rows.push(row);
    });

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 20,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 80, 158] }
    });

    doc.save(`${filename}.pdf`);
  };

  document.querySelectorAll(".panel-search").forEach((input) => {
    input.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const panel = input.closest(".category-panel");
      const tableId = panel.querySelector("table").id;
      const rows = document.querySelectorAll(`#${tableId} tbody tr`);
      rows.forEach((row) => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(searchTerm) ? "" : "none";
      });
    });
  });

  renderPengaduanTable();
  renderSaranTable();
  renderGratifikasiTable();
  renderOfflineTable();
}

function initOfflinePage() {
  const form = document.getElementById("offlineForm");
  const formContainer = document.getElementById("formContainer");
  const successContainer = document.getElementById("successContainer");
  const btnSimpan = document.getElementById("btnSimpan");
  const errorAlert = document.getElementById("errorAlert");
  if (!form) return;

  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
  });

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("dokumentasi");
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "var(--merah-utama)";
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.style.borderColor = "";
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "";
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        updateDropzoneLabel();
      }
    });
    fileInput.addEventListener("change", updateDropzoneLabel);
  }

  function updateDropzoneLabel() {
    const label = document.getElementById("dropzoneLabel");
    if (label && fileInput.files.length) {
      label.innerHTML = `<strong>${fileInput.files[0].name}</strong> dipilih`;
    }
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (errorAlert) errorAlert.style.display = "none";

    const tanggalPengaduan = document.getElementById("tanggalPengaduan")?.value || "";
    const namaPetugas = document.getElementById("namaPetugas")?.value.trim() || "";
    const nama = document.getElementById("nama")?.value.trim() || "";
    const alamat = document.getElementById("alamat")?.value.trim() || "";
    const noHp = document.getElementById("noHp")?.value.trim() || "";
    const materiPengaduan = document.getElementById("materiPengaduan")?.value.trim() || "";
    const jawabanPetugas = document.getElementById("jawabanPetugas")?.value.trim() || "";
    const file = fileInput?.files?.[0];

    if (!tanggalPengaduan || !namaPetugas || !nama || !alamat || !noHp || !materiPengaduan || !jawabanPetugas || !file) {
      if (errorAlert) {
        errorAlert.style.display = "block";
        errorAlert.textContent = "Mohon lengkapi semua kolom wajib, termasuk foto Dokumentasi.";
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      if (errorAlert) {
        errorAlert.style.display = "block";
        errorAlert.textContent = "Ukuran file Dokumentasi maksimal 10 MB.";
      }
      return;
    }

    if (btnSimpan) {
      btnSimpan.innerHTML = '<span class="spinner"></span> Menyimpan ke Sistem...';
      btnSimpan.disabled = true;
    }

    try {
      const uniqueCode = generateKode("BPS-OFL");
      const dokumentasiUrl = await unggahSatuFile(file, "dokumentasi-offline");

      await addDoc(collection(db, KOLEKSI_KONSULTASI_DTSEN), {
        kodeUnik: uniqueCode,
        tanggalPengaduan,
        namaPetugas,
        nama,
        alamat,
        telepon: noHp,
        email: "",
        kategori: "Konsultasi DataSEN",
        materi: materiPengaduan,
        laporan: materiPengaduan,
        dokumentasiUrl,
        status: "Selesai",
        sumber: "Offline",
        diinputOleh: namaPetugas,
        tanggal: new Date().toISOString(),
        tanggapan: jawabanPetugas
      });

      if (formContainer) formContainer.style.display = "none";
      if (successContainer) successContainer.style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Gagal menyimpan pengaduan offline:", error);
      showToast(pesanKesalahanPengiriman(error, "konsultasi DTSEN"), "error");
      if (btnSimpan) {
        btnSimpan.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Konsultasi';
        btnSimpan.disabled = false;
      }
    }
  });
}

function initAntiGratifikasiPage() {
  const form = document.getElementById("gratifikasiForm");
  const formContainer = document.getElementById("formContainer");
  const successContainer = document.getElementById("successContainer");
  const btnSimpan = document.getElementById("btnSimpanGratifikasi");
  if (!form) return;

  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
  });

  const MAX_FILES = 10;
  const MAX_SIZE_MB = 10;

  const bentukLainnyaCheck = document.getElementById("bentukLainnyaCheck");
  const bentukLainnyaWrapper = document.getElementById("bentukLainnyaWrapper");
  if (bentukLainnyaCheck && bentukLainnyaWrapper) {
    bentukLainnyaCheck.addEventListener("change", () => {
      bentukLainnyaWrapper.classList.toggle("show", bentukLainnyaCheck.checked);
    });
  }

  const dropzone = document.getElementById("dropzoneGratifikasi");
  const fileInput = document.getElementById("lampiranGratifikasi");
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "var(--merah-utama)";
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.style.borderColor = "";
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "";
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        updateDropzoneLabel();
      }
    });
    fileInput.addEventListener("change", updateDropzoneLabel);
  }

  function validateFiles(files) {
    if (!files || files.length === 0) {
      showToast("Mohon unggah minimal satu foto barang yang diberikan.", "error");
      return false;
    }
    if (files.length > MAX_FILES) {
      showToast(`Maksimal ${MAX_FILES} file yang dapat diunggah.`, "error");
      return false;
    }
    for (const f of files) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        showToast(`File "${f.name}" melebihi ukuran maksimal ${MAX_SIZE_MB}MB.`, "error");
        return false;
      }
    }
    return true;
  }

  function updateDropzoneLabel() {
    const label = document.getElementById("dropzoneGratifikasiLabel");
    if (!label || !fileInput.files.length) return;
    if (!validateFiles(fileInput.files)) {
      fileInput.value = "";
      label.innerHTML = "<strong>Unggah foto barang</strong> atau seret ke sini";
      return;
    }
    label.textContent = `${fileInput.files.length} file dipilih`;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const namaPemberi = document.getElementById("namaPemberi")?.value.trim() || "";
    const tanggalGratifikasi = document.getElementById("tanggalGratifikasi")?.value || "";
    const instansiPemberi = document.getElementById("instansiPemberi")?.value.trim() || "";
    const alasanDiterima = document.getElementById("alasanDiterima")?.value.trim() || "";
    const tindakLanjutBarang = document.querySelector('input[name="tindakLanjutBarang"]:checked')?.value || "";
    const bentukChecked = Array.from(document.querySelectorAll('input[name="bentuk"]:checked')).map((el) => el.value);
    const bentukError = document.getElementById("bentukError");

    if (!tanggalGratifikasi) {
      showToast("Mohon isi tanggal penerimaan gratifikasi.", "error");
      return;
    }
    if (bentukChecked.length === 0) {
      if (bentukError) bentukError.style.display = "block";
      document.getElementById("bentukPemberianList")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!tindakLanjutBarang) {
      showToast("Mohon pilih tindak lanjut barang yang diterima.", "error");
      return;
    }
    if (bentukError) bentukError.style.display = "none";

    const bentukLainnyaText = document.getElementById("bentukLainnyaText")?.value.trim() || "";
    const bentukFinal = bentukChecked.map((v) =>
      v === "Lainnya" && bentukLainnyaText ? `Lainnya: ${bentukLainnyaText}` : v
    );

    if (!validateFiles(fileInput?.files)) return;

    if (btnSimpan) {
      btnSimpan.innerHTML = '<span class="spinner"></span> Menyimpan ke Sistem...';
      btnSimpan.disabled = true;
    }

    try {
      const uniqueCode = generateKode("BPS-GRAT");
      const fotoUrls = [];
      const files = fileInput?.files ? Array.from(fileInput.files) : [];
      for (const file of files) {
        const url = await unggahKeCloudinary(file, "gratifikasi");
        fotoUrls.push({ nama: file.name, url: url });
      }

      await addDoc(collection(db, "gratifikasi"), {
        kodeUnik: uniqueCode,
        namaPemberi,
        instansiPemberi,
        bentukPemberian: bentukFinal,
        fotoBarang: fotoUrls,
        tindakLanjutBarang,
        alasanDiterima,
        status: "Tercatat",
        sumber: "Manual",
        tanggal: tanggalGratifikasi,
        tanggalGratifikasi,
        dibuatPada: new Date().toISOString()
      });

      if (formContainer) formContainer.style.display = "none";
      if (successContainer) successContainer.style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Gagal menyimpan laporan gratifikasi:", error);
      showToast(pesanKesalahanPengiriman(error, "Antigratifikasi"), "error");
      if (btnSimpan) {
        btnSimpan.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Laporan Gratifikasi';
        btnSimpan.disabled = false;
      }
    }
  });
}

function initIndexMonitorPage() {
  const totalEl = document.getElementById("monTotal");
  const diprosesEl = document.getElementById("monDiproses");
  const selesaiEl = document.getElementById("monSelesai");
  const saranEl = document.getElementById("monSaran");
  if (!totalEl) return;

  function animateNumber(el, target) {
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(target * progress).toLocaleString("id-ID");
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  Promise.all([
    getDocs(collection(db, "pengaduan")),
    getDocs(collection(db, "saran"))
  ])
  .then(([pengaduanSnap, saranSnap]) => {
    let diproses = 0;
    let selesai = 0;
    let totalOnline = 0;

    pengaduanSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.sumber === "Offline" || data.sumberInput === "manual-admin") return;
      totalOnline++;
      const status = normalizeStatus(data.status);
      if (status === "Diproses") diproses++;
      if (status === "Selesai") selesai++;
    });

    animateNumber(totalEl, totalOnline);
    if (diprosesEl) animateNumber(diprosesEl, diproses);
    if (selesaiEl) animateNumber(selesaiEl, selesai);
    if (saranEl) animateNumber(saranEl, saranSnap.size);
  })
  .catch((error) => {
    console.error("Gagal memuat data monitoring:", error);
    totalEl.textContent = "-";
    if (diprosesEl) diprosesEl.textContent = "-";
    if (selesaiEl) selesaiEl.textContent = "-";
    if (saranEl) saranEl.textContent = "-";
  });
}

function initMonitorTabs() {
  document.querySelectorAll('.monitor-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.monitor-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.monitor-tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.target);
      if (target) target.classList.add('active');
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initScrollReveal();
  initIndexMonitorPage();
  initMonitorTabs();
  initPengaduanPage();
  initSaranPage();
  initCekStatusPage();
  initLoginPage();
  initDashboardPage();
  initOfflinePage();
  initAntiGratifikasiPage();
});