const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/health`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}

export async function getServicesStatus() {
  const response = await fetch(`${API_BASE_URL}/services`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch services status: ${response.statusText}`);
  }

  return response.json();
}
