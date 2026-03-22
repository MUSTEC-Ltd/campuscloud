const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

export async function getProjects(token) {
  const res = await fetch(`${BASE_URL}/project`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch projects');
  return data;
}

export async function createProject(name, token) {
  const res = await fetch(`${BASE_URL}/project`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to create project');
  return data;
}
