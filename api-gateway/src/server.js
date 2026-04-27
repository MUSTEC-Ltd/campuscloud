const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const router = require("./router");
const services = require("./services.json");
const checkServices = require("./healthCheck");

const app = express();

// Restrict CORS to known frontend origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// Health and service discovery — not rate-limited
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "CampusCloud API Gateway" });
});

app.get("/services", async (req, res) => {
  const status = await checkServices(services);
  res.json(status);
});

// Rate limit all proxied routes
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use("/", router);

app.listen(3000, () => {
  console.log("API Gateway running on port 3000");
});
