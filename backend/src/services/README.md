# CampusCloud Frontend Services Wrapper

This directory contains the API client services used by the Next.js frontend dashboard to communicate with the central API Gateway. It abstracts all HTTP requests, providing typed functions and interfaces for easy integration.

## Architecture

```text
Frontend Dashboard (Next.js) → Services Wrapper (api.ts) → API Gateway (Port 3000)
```

## Structure

The services are divided by domain:

* `auth/api.ts` - Login and registration logic
* `project/api.ts` - Project creation and listing
* `compute/api.ts` - Container instance management (launch, list, delete)
* `gateway/api.ts` - Gateway health check and backend services status

## Environment Variables

The services expect the API Gateway URL to be available via environment variables. If not provided, it defaults to localhost.

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Usage Example

Import the typed functions directly into your frontend components or server actions:

```tsx
import { login } from '@/services/auth/api';
import { getProjects } from '@/services/project/api';

// Example: Authenticate a user
const response = await login({ email: "user@example.com", password: "123" });
console.log(response.token);

// Example: Fetch user projects
const { projects } = await getProjects();
projects.forEach(p => console.log(p.name));
```

## Error Handling

Each function automatically checks the response status. If the API Gateway or backend service returns an error (or the request fails), the function throws a descriptive error that can be caught in your UI components:

```tsx
try {
  await login(credentials);
} catch (error) {
  console.error("Login failed:", error.message);
  // Show error in UI
}
```

## Note for Developers
This folder relies on the native `fetch` API and does not require external libraries like `axios`. All request and response types are strictly defined in their respective `api.ts` files, ensuring type safety across the frontend.
