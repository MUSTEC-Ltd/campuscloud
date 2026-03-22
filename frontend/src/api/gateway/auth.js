const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function login(credentials) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  return response.json();
}

export async function register(userData) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    throw new Error(`Registration failed: ${response.statusText}`);
  }

  return response.json();
}
