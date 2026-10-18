const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const getStorageConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const bucket = import.meta.env.VITE_SUPABASE_PROFILE_BUCKET || "profile-images";

  if (!url || !anonKey) {
    throw new Error("Supabase Storage is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  return { url: url.replace(/\/$/, ""), anonKey, bucket };
};

const validateImage = (file) => {
  if (!file) throw new Error("Choose a profile photo.");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Use a JPG, PNG, or WebP image.");
  if (file.size > MAX_PROFILE_IMAGE_SIZE) throw new Error("Profile photos must be 5 MB or smaller.");
};

const createFilePath = (file) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `profiles/${id}.${extension}`;
};

export const uploadProfileImage = async (file) => {
  validateImage(file);
  const { url, anonKey, bucket } = getStorageConfig();
  const filePath = createFilePath(file);
  const uploadUrl = `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${filePath.split("/").map(encodeURIComponent).join("/")}`;

  let response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      body: file,
    });
  } catch {
    throw new Error("Could not reach Supabase Storage. Check VITE_SUPABASE_URL, your internet connection, then restart the frontend server.");
  }

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.message || details.error || "Profile photo upload failed.");
  }

  return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
};
