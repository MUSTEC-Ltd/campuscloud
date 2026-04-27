# CampusCloud Frontend Gateway Services

This directory previously contained API client service wrappers. These have been relocated to `frontend/src/api/gateway/` to align with the actual frontend package (React + Vite).

## New Location

The API client wrappers for communicating with the API Gateway are now in:

```text
frontend/src/api/gateway/
├── auth.js      - Login and registration
├── project.js   - Project creation and listing
├── compute.js   - Container instance management (launch, list, delete)
└── health.js    - Gateway health check and backend services status
```

## Architecture

```text
Frontend Dashboard (React + Vite) → Gateway Services (frontend/src/api/gateway/) → API Gateway (Port 3000)
```

## Environment Variables

The services use `import.meta.env.VITE_API_URL` (the standard Vite env variable). Set it in `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
```

If not provided, it defaults to `http://localhost:3000`.

## Usage Example

Import the functions directly into your frontend components:

```js
import { login } from './gateway/auth';
import { getProjects } from './gateway/project';

// Example: Authenticate a user
const response = await login({ email: "user@example.com", password: "123" });
console.log(response.token);

// Example: Fetch user projects (pass the JWT token)
const { projects } = await getProjects(token);
projects.forEach(p => console.log(p.name));
```

## Error Handling

Each function throws a descriptive error if the API Gateway or backend service returns a non-OK response:

```js
try {
  await login(credentials);
} catch (error) {
  console.error("Login failed:", error.message);
  // Show error in UI
}
```

