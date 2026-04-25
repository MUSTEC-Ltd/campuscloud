import { apiFetch } from './http';
import { isDemoMode, getDemoProjects, saveDemoProjects, DEMO_TOKEN, DEMO_USER_ID } from './mock-seed';

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
    const res = await apiFetch('/project', {}, token);
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
  const res = await apiFetch('/project', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }, token);
  return jsonOr(res, 'Failed to create project');
}

export async function getProjectMembers(projectId, token) {
  if (isDemo(token)) {
    return [{ user_id: DEMO_USER_ID, email: 'demo@campuscloud.local', role: 'owner', added_at: new Date().toISOString() }];
  }
  const res = await apiFetch(`/project/${projectId}/members`, {}, token);
  return jsonOr(res, 'Failed to load members');
}

export async function addProjectMember(projectId, { email, role }, token) {
  if (isDemo(token)) throw new Error('Member management is disabled in demo mode.');
  const res = await apiFetch(`/project/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  }, token);
  return jsonOr(res, 'Failed to add member');
}

export async function removeProjectMember(projectId, userId, token) {
  if (isDemo(token)) throw new Error('Member management is disabled in demo mode.');
  const res = await apiFetch(`/project/${projectId}/members/${userId}`, {
    method: 'DELETE',
  }, token);
  return jsonOr(res, 'Failed to remove member');
}
