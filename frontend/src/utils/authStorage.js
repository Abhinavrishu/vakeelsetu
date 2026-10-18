const AUTH_KEY = "vakeelsetu-auth";

export const getAuthUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setAuthUser = (session) => {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
};

export const clearAuthUser = () => {
  localStorage.removeItem(AUTH_KEY);
};
