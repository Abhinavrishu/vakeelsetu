import { request } from "./httpClient";

export const signIn = (credentials) =>
  request("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

export const signUp = (details) =>
  request("/auth/register", {
    method: "POST",
    body: JSON.stringify(details),
  });

export const updateProfile = (profile, accessToken) =>
  request("/auth/me", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(profile),
  });

export const getEncryptionPublicKey = (userId, accessToken) =>
  request(`/auth/encryption-key/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });

export const saveEncryptionIdentity = (identity, accessToken) =>
  request("/auth/encryption-identity", {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(identity),
  });
