const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function launchInstance(instanceData, token) {
  const response = await fetch(`${API_BASE_URL}/compute/instance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: JSON.stringify(instanceData),
  });

  if (!response.ok) {
    throw new Error(`Instance launch failed: ${response.statusText}`);
  }

  return response.json();
}

export async function listInstances(token) {
  const response = await fetch(`${API_BASE_URL}/compute/instances`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch instances: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteInstance(id, token) {
  const response = await fetch(`${API_BASE_URL}/compute/instance/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Instance deletion failed: ${response.statusText}`);
  }

  return response.json();
}
