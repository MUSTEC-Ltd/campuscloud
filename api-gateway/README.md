# CampusCloud API Gateway

## Overview

This component is the **API Gateway** for the CampusCloud platform, serving as the single entry point for all client requests from the frontend dashboard. It dynamically routes HTTP requests to the appropriate microservices (Auth, Project, Compute) in the backend cluster.

This service is part of Phase 1 (Control Plane) and handles internal routing, load balancing, rate limiting, and service health capabilities.

---

## Architecture

```text
   Client (Frontend Dashboard)
              │
              ▼
        API Gateway
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
  Auth     Project   Compute
 Service   Service   Service
    │         │         │
    └─────────┼─────────┘
              ▼
          Database
```

---

## Key Features

* **Dynamic Request Routing:** Forwards requests (`/:service/*path`) using a service registry.
* **Express 5 Ready:** Handles array-based parameter parsing for wildcard nested routes.
* **Load Balancing:** Distributes requests evenly across multiple service instances via Round-Robin.
* **Retry Mechanism:** Automatically retries failed requests up to 3 times before returning a 500 error.
* **Rate Limiting:** Protects backend services from abuse (configured to 100 requests per minute).
* **Health Monitoring:** Dedicated endpoints to check gateway health and upstream backend status.
* **Request Logging:** Logs all incoming traffic and outgoing responses using `morgan`.

---

## Folder Structure

```text
api-gateway/
├── src/
│   ├── server.js          # Express app, Rate Limiting, CORS, Logging
│   ├── router.js          # Dynamic route handler mapping requests
│   ├── proxy.js           # Forwards HTTP requests to target backends using Axios
│   ├── retry.js           # 3-attempt retry middleware
│   ├── loadBalancer.js    # Round-Robin instance selection algorithm
│   ├── healthCheck.js     # Upstream service health aggregate
│   └── services.json      # Service Registry configuration (URLs of backend nodes)
│
└── package.json
```

---

## Installation & Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the gateway:
   ```bash
   npm run dev
   ```
   *Gateway runs on `http://localhost:3000`*

3. To test endpoints manually, use PowerShell or Postman (see [Example Requests](#example-requests) below).

---

## Service Registry (`src/services.json`)

To add or modify backend routes, update the `services.json` file. The API Gateway automatically load balances across all URLs listed in the array for a given service.

```json
{
  "auth": [ "http://localhost:5001" ],
  "project": [ "http://localhost:5002" ],
  "compute": [ "http://localhost:5003" ]
}
```

---

## Integration Instructions for Other Teams (Phase 1)

When the other teams (A1-A4 for Identity/Project, B1-B3 for Compute) finish their actual microservices, and you are ready to connect the **real frontend** and **real backend** together, follow these steps:

### 1. Connecting the Frontend (React + Vite Dashboard)
The frontend team needs to know where the Gateway is hosted. In the `frontend/.env` file, set the API URL to point at the gateway:
```env
VITE_API_URL=http://localhost:3000
```
This configures the frontend API client wrappers (located in `frontend/src/api/gateway/`) to route all user dashboard actions (login, create project) directly into the API Gateway.

### 2. Connecting the Backend Microservices (Data Plane)
The API Gateway uses `src/services.json` as its routing table. When teams spin up the real `Auth`, `Project`, and `Compute` services, you must **replace the mock URLs** with their actual host IPs or ports:
```json
{
  "auth": [ "http://real-auth-service:PORT" ],
  "project": [ "http://real-project-service:PORT" ],
  "compute": [ "http://real-compute-service:PORT", "http://compute-replica:PORT" ]
}
```
If a team spins up multiple instances of a container for load balancing, simply add all of their URLs into the array. The Gateway's `loadBalancer.js` will automatically detect them and start distributing traffic!

---

## API Endpoints

### Health & Monitoring

**Health Check**
```text
GET /health
```
Response:
```json
{
  "status": "API Gateway running"
}
```

**Service Status**
```text
GET /services
```
Returns the health status (`UP`/`DOWN`) of all backend instances registered in the gateway.

---

### Authentication (via Auth Service)

```text
POST /auth/login
POST /auth/register
```

---

### Project Management (via Project Service)

```text
POST /project/project
GET /project/projects
```

---

### Compute Service

```text
POST /compute/instance
GET /compute/instances
DELETE /compute/instance/{id}
```

---

## Example Requests

Using PowerShell:

```powershell
# Check Health
Invoke-RestMethod -Uri http://localhost:3000/health

# Login User
Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/login -ContentType "application/json" -Body '{"email":"test@test.com","password":"123"}'

# Create Project
Invoke-RestMethod -Method POST -Uri http://localhost:3000/project/project -ContentType "application/json" -Body '{"name":"myproject"}'

# Launch Instance
Invoke-RestMethod -Method POST -Uri http://localhost:3000/compute/instance -ContentType "application/json" -Body '{"projectId":"1","image":"ubuntu"}'
```

---

## Error Handling

### Service not found
Returned when requesting a route for a service not in `services.json` (404 Not Found):
```json
{
  "error": "Service not found"
}
```

### Backend unavailable
Returned when the backend service is down or fails after 3 retries (500 Internal Server Error):
```json
{
  "error": "Backend service unavailable"
}
```

---

## Testing & Validation

Test all components using:
* PowerShell (`Invoke-RestMethod`)
* Browser (for GET endpoints like `/health` and `/services`)
* Postman

---

## Notes

* The gateway uses dynamic routing based on URL paths (`/:service/*path`).
* Gateway handles only external client requests; internal services communicate directly when required.

---

## Contributors

**Team A7**
CampusCloud Project
Cloud Computing Course

---

## License

This project is for educational purposes only.
