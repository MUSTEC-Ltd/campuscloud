const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const router = require("./router");
const services = require("./services.json");
const checkServices = require("./healthCheck");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100
});

app.use(limiter);

app.get("/health", (req, res) => {

  res.json({
    status: "API Gateway running"
  });

});

app.get("/services", async (req, res) => {

  const status = await checkServices(services);

  res.json(status);

});

app.use("/", router);

app.listen(3000, () => {
  console.log("API Gateway running on port 3000");
});