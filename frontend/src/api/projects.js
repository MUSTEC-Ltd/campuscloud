import { isDemoMode, getDemoProjects, saveDemoProjects, DEMO_TOKEN, DEMO_USER_ID } from './mock-seed';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

async function jsonOr(res, defaultMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || defaultMessage);
  return data;
}

function isDemo(token) {
  return isDemoMode() || token === DEMO_TOKEN;
}

export async function getProjects(token) {
  if (isDemo(token)) return getDemoProjects();
  try {
    const res = await fetch(`${BASE_URL}/project`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    return jsonOr(res, 'Failed to fetch projects');
  } catch (err) {
    if (err instanceof TypeError) return getDemoProjects();
    throw err;
  }
}

export async function createProject(name, token) {
  if (isDemo(token)) {
    const projects = getDemoProjects();
    const newProject = {
      id: `demo-proj-${Date.now()}`,
      name,
      description: '',
      owner_id: DEMO_USER_ID,
      status: 'active',
      created_at: new Date().toISOString(),
      role: 'owner',
    };
    saveDemoProjects([...projects, newProject]);
    return { message: 'Project created', project: newProject };
  }
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
  if (isDemo(token)) {
    return [{ user_id: DEMO_USER_ID, email: 'demo@campuscloud.local', role: 'owner', added_at: new Date().toISOString() }];
  }
  const res = await fetch(`${BASE_URL}/project/${projectId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return jsonOr(res, 'Failed to load members');
}

export async function addProjectMember(projectId, { email, role }, token) {
  if (isDemo(token)) throw new Error('Member management is disabled in demo mode.');
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
  if (isDemo(token)) throw new Error('Member management is disabled in demo mode.');
  const res = await fetch(`${BASE_URL}/project/${projectId}/members/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return jsonOr(res, 'Failed to remove member');
}
