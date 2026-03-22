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

  const instance = getServiceInstance(service, services);

  const targetUrl = `${instance}/${path}`;

  console.log(`Forwarding ${req.method} → ${targetUrl}`);

  try {

    const data = await forwardRequest(req, targetUrl);

    res.json(data);

  } catch (err) {

    res.status(500).json({
      error: "Backend service unavailable"
    });

  }

});

module.exports = router;