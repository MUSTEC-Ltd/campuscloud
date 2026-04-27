const express = require("express");
const services = require("./services.json");
const forwardRequest = require("./proxy");
const getServiceInstance = require("./loadBalancer");

const router = express.Router();

router.all("/:service/*path", async (req, res) => {

  const service = req.params.service;

  if (!services[service]) {
    return res.status(404).json({
      error: "Service not found"
    });
  }

  const pathParam = req.params.path;
  const path = Array.isArray(pathParam) ? pathParam.join('/') : pathParam;

  let instance;
  try {
    instance = getServiceInstance(service, services);
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const queryString = new URLSearchParams(req.query).toString();
  const targetUrl = queryString ? `${instance}/${path}?${queryString}` : `${instance}/${path}`;

  console.log(`Forwarding ${req.method} → ${targetUrl}`);

  try {

    const response = await forwardRequest(req, targetUrl);

    res.status(response.status).set(response.headers).send(response.data);

  } catch (err) {

    if (err && err.response) {
      res
        .status(err.response.status || 500)
        .set(err.response.headers || {})
        .send(err.response.data);
    } else {
      res.status(500).json({
        error: "Backend service unavailable"
      });
    }

  }

});

module.exports = router;