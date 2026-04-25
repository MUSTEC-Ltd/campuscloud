import { DEMO_TOKEN, DEMO_USER_ID, enableDemoMode } from './mock-seed';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

export async function login(email, password) {
  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    return { ...data, demoMode: false };
  } catch (err) {
    if (err instanceof TypeError) {
      // Backend unreachable — enter demo mode with seeded mock data
      enableDemoMode();
      return {
        accessToken: DEMO_TOKEN,
        user: { id: DEMO_USER_ID, email },
        demoMode: true,
      };
    }
    throw err;
  }
}

export async function register(email, password) {
  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Cannot reach the server. The backend may be offline.');
    }
    throw err;
  }
}

export async function logout() {
  try {
    await fetch(`${BASE_URL}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Ignore network errors on logout
  }
}
