const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function createProject(projectData, token) {
  const response = await fetch(`${API_BASE_URL}/project/project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: JSON.stringify(projectData),
  });

  if (!response.ok) {
    throw new Error(`Project creation failed: ${response.statusText}`);
  }

  return response.json();
}

export async function getProjects(token) {
  const response = await fetch(`${API_BASE_URL}/project/projects`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }

  return response.json();
}
