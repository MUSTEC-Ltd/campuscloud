const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Response Types

export interface HealthResponse {
  status: string;
}

export interface ServiceInstance {
  url: string;
  status: "UP" | "DOWN";
}

export interface ServicesStatusResponse {
  [serviceName: string]: ServiceInstance[];
}

// API Functions

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}

export async function getServicesStatus(): Promise<ServicesStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/services`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch services status: ${response.statusText}`);
  }

  return response.json();
}
