export const CLOUDINARY_CLOUD_NAME = "nlezrrhe";
export const CLOUDINARY_UPLOAD_PRESET = "pritkotas";

export async function unggahKeCloudinary(file, folder) {
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append("folder", folder);

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gagal mengunggah file ke Cloudinary (${response.status}): ${detail}`);
  }

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error("Cloudinary tidak mengembalikan secure_url untuk file yang diunggah.");
  }
  return data.secure_url;
}
