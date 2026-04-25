/**
 * Thin wrapper around fetch() that:
 *  - Automatically attempts a token refresh on 401 Token expired responses
 *  - Fires a custom "cc:sessionexpired" event if refresh also fails,
 *    which AuthContext listens for to force logout
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

let refreshPromise = null;

async function refreshAccessToken() {
  const res = await fetch(`${BASE_URL}/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('refresh_failed');
  const { accessToken } = await res.json();
  return accessToken;
}

export async function apiFetch(path, options = {}, token = null) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // If token expired, try a silent refresh once
  if (res.status === 401) {
    let body;
    try { body = await res.clone().json(); } catch { body = {}; }

    if (body.error === 'Token expired' && token) {
      // Deduplicate concurrent refresh calls
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      }
      try {
        const newToken = await refreshPromise;
        // Retry original request with fresh token
        const retry = await fetch(`${BASE_URL}${path}`, {
          ...options,
          headers: { ...headers, Authorization: `Bearer ${newToken}` },
          credentials: 'include',
        });
        // Persist new token to localStorage so AuthContext picks it up next render
        localStorage.setItem('cc_token', newToken);
        return retry;
      } catch {
        // Refresh failed — force logout
        window.dispatchEvent(new CustomEvent('cc:sessionexpired'));
        throw new Error('Session expired. Please sign in again.');
      }
    }

    // Other 401 (invalid token, demo token rejected, etc.) — fire logout event
    if (body.error && body.error !== 'Token expired') {
      // Don't force logout for every 401 — just pass through
    }
  }

  return res;
}
