const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEVICE_DB = "vakeelsetu-e2e";
const DEVICE_STORE = "identities";
const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const openDeviceDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DEVICE_DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(DEVICE_STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error("Unable to open device key storage."));
});

const deviceIdentity = async (userId, mode, value) => {
  const db = await openDeviceDb();
  return new Promise((resolve, reject) => {
    const store = db.transaction(DEVICE_STORE, mode === "write" ? "readwrite" : "readonly").objectStore(DEVICE_STORE);
    const request = mode === "write" ? store.put(value, userId) : store.get(userId);
    request.onsuccess = () => resolve(mode === "write" ? undefined : request.result || null);
    request.onerror = () => reject(request.error || new Error("Unable to access device key storage."));
  });
};

// The private key is non-extractable and remains only in this browser's IndexedDB.
export const createDeviceEncryptionIdentity = async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const encryptionPublicKey = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
  return { encryptionPublicKey, privateKey };
};

export const saveDeviceEncryptionIdentity = (userId, identity) => deviceIdentity(userId, "write", identity);
export const getDeviceEncryptionIdentity = (userId) => deviceIdentity(userId, "read");

const derivePassphraseKey = async (passphrase, salt) => {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
};

export const createEncryptionIdentity = async (passphrase) => {
  if (passphrase.length < 12) throw new Error("Use a recovery passphrase with at least 12 characters.");
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const privateKey = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivePassphraseKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(privateKey));
  return {
    encryptionPublicKey: JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey)),
    encryptedPrivateKeyBackup: JSON.stringify({ v: 1, salt: toBase64(salt), iv: toBase64(iv), cipher: toBase64(cipher) }),
  };
};

export const unlockPrivateKey = async (backup, passphrase) => {
  const data = JSON.parse(backup);
  const key = await derivePassphraseKey(passphrase, fromBase64(data.salt));
  const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(data.iv) }, key, fromBase64(data.cipher));
  return crypto.subtle.importKey("jwk", JSON.parse(decoder.decode(raw)), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
};

const conversationKey = async (privateKey, publicKeyJson) => {
  const publicKey = await crypto.subtle.importKey("jwk", JSON.parse(publicKeyJson), { name: "ECDH", namedCurve: "P-256" }, false, []);
  return crypto.subtle.deriveKey({ name: "ECDH", public: publicKey }, privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
};

export const encryptChatContent = async (content, privateKey, recipientPublicKey, conversationId) => {
  return encryptChatPayload({ type: "text", text: content }, privateKey, recipientPublicKey, conversationId);
};

const encryptChatPayload = async (payload, privateKey, recipientPublicKey, conversationId) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(conversationId) }, await conversationKey(privateKey, recipientPublicKey), encoder.encode(JSON.stringify(payload)));
  return JSON.stringify({ e2e: 1, v: 2, iv: toBase64(iv), cipher: toBase64(cipher) });
};

export const decryptChatContent = async (content, privateKey, senderPublicKey, conversationId) => {
  const envelope = JSON.parse(content);
  if (envelope.e2e !== 1) return content;
  const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv), additionalData: encoder.encode(conversationId) }, await conversationKey(privateKey, senderPublicKey), fromBase64(envelope.cipher));
  const payload = JSON.parse(decoder.decode(raw));
  return payload.type === "text" ? payload.text : payload;
};

export const encryptChatFile = async (file, privateKey, recipientPublicKey, conversationId) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return encryptChatPayload({
    type: "file",
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    data: toBase64(bytes),
  }, privateKey, recipientPublicKey, conversationId);
};

export const downloadDecryptedFile = (attachment) => {
  const bytes = fromBase64(attachment.data);
  const url = URL.createObjectURL(new Blob([bytes], { type: attachment.mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.name || "encrypted-file";
  link.click();
  URL.revokeObjectURL(url);
};

export const sha256 = async (data) => toBase64(await crypto.subtle.digest("SHA-256", data));
