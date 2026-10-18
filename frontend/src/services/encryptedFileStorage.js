const getStorageConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const bucket = import.meta.env.VITE_SUPABASE_CHAT_BUCKET || "encrypted-chat-files";
  if (!url || !anonKey) throw new Error("Supabase Storage is not configured for encrypted attachments.");
  return { url: url.replace(/\/$/, ""), anonKey, bucket };
};

const objectPath = () => {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `chat/${id}.bin`;
};

const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");

// This bucket can be public because every uploaded object is AES-GCM ciphertext.
// Its URL and all file metadata are sent only inside the E2E message envelope.
export const uploadEncryptedAttachment = async (ciphertext) => {
  const { url, anonKey, bucket } = getStorageConfig();
  const path = objectPath();
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(path)}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/octet-stream",
      "x-upsert": "false",
    },
    body: ciphertext,
  }).catch(() => { throw new Error("Could not reach encrypted file storage."); });

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.message || details.error || "Encrypted file upload failed. Create the encrypted-chat-files bucket and allow uploads.");
  }

  return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodePath(path)}`;
};

export const fetchEncryptedAttachment = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Encrypted attachment is unavailable.");
  return response.arrayBuffer();
};
