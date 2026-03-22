const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Request Types

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

// Response Types

export interface Project {
  id: string;
  name: string;
  description?: string;
}

export interface CreateProjectResponse {
  message: string;
  project?: Project;
}

export interface GetProjectsResponse {
  projects: Project[];
}

// API Functions

export async function createProject(projectData: CreateProjectRequest): Promise<CreateProjectResponse> {
  const response = await fetch(`${API_BASE_URL}/project/project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(projectData),
  });

  if (!response.ok) {
    throw new Error(`Project creation failed: ${response.statusText}`);
  }

  return response.json();
}

export async function getProjects(): Promise<GetProjectsResponse> {
  const response = await fetch(`${API_BASE_URL}/project/projects`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }

  return response.json();
}
