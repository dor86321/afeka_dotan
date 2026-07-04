export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export function getAdminUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adminUsername");
}

export function isAdminLoggedIn(): boolean {
  return Boolean(getAdminToken());
}

export function adminAuthHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAdminToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function setAdminSession(accessToken: string, username: string) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("adminUsername", username);
}

export function clearAdminSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("adminUsername");
}
