const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

async function jsonOr(res, defaultMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || defaultMessage);
  return data;
}

export async function getProjects(token) {
  const res = await fetch(`${BASE_URL}/project`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return jsonOr(res, 'Failed to fetch projects');
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
  return jsonOr(res, 'Failed to create project');
}

export async function getProjectMembers(projectId, token) {
  const res = await fetch(`${BASE_URL}/project/${projectId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return jsonOr(res, 'Failed to load members');
}

export async function addProjectMember(projectId, { email, role }, token) {
  const res = await fetch(`${BASE_URL}/project/${projectId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    body: JSON.stringify({ email, role }),
  });
  return jsonOr(res, 'Failed to add member');
}

export async function removeProjectMember(projectId, userId, token) {
  const res = await fetch(`${BASE_URL}/project/${projectId}/members/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return jsonOr(res, 'Failed to remove member');
}
