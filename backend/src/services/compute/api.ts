const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Request Types

export interface LaunchInstanceRequest {
  projectId: string;
  image?: string;
  cpuLimit?: string;
  memoryLimit?: string;
}

// Response Types

export interface Instance {
  id: string;
  name: string;
  status: string;
  projectId: string;
}

export interface LaunchInstanceResponse {
  message: string;
  instance?: Instance;
}

export interface ListInstancesResponse {
  instances: Instance[] | string[];
}

export interface DeleteInstanceResponse {
  message: string;
}

// API Functions

export async function launchInstance(instanceData: LaunchInstanceRequest): Promise<LaunchInstanceResponse> {
  const response = await fetch(`${API_BASE_URL}/compute/instance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(instanceData),
  });

  if (!response.ok) {
    throw new Error(`Instance launch failed: ${response.statusText}`);
  }

  return response.json();
}

export async function listInstances(): Promise<ListInstancesResponse> {
  const response = await fetch(`${API_BASE_URL}/compute/instances`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch instances: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteInstance(id: string): Promise<DeleteInstanceResponse> {
  const response = await fetch(`${API_BASE_URL}/compute/instance/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Instance deletion failed: ${response.statusText}`);
  }

  return response.json();
}
