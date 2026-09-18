export function tampilkanAlert(elId, pesan, tipe = "info") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = pesan;
  el.className = `alert alert--${tipe} tampil`;
}

export function sembunyikanAlert(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.remove("tampil");
}

export function formatTanggal(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function buatAlurStatusHTML(status) {
  const urutan = ["menunggu", "diproses", "selesai"];
  const posisi = urutan.indexOf(status);
  return `
    <div class="alur-status">
      ${urutan
        .map((tahap, i) => {
          const aktif = i <= posisi ? `aktif ${tahap}` : "";
          const titik = `<div class="titik ${aktif}">${i + 1}</div>`;
          const garis =
            i < urutan.length - 1
              ? `<div class="garis ${i < posisi ? "aktif" : ""}"></div>`
              : "";
          return titik + garis;
        })
        .join("")}
    </div>`;
}

export function pasangTombolLogout(fnLogout) {
  const btn = document.getElementById("btnLogout");
  if (!btn) return;
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    await fnLogout();
    window.location.href = "login.html";
  });
}
