const axios = require("axios");
const retryRequest = require("./retry");

async function forwardRequest(req, targetUrl) {

  const response = await retryRequest(() =>
    axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: req.headers
    })
  );

  return response.data;
}

module.exports = forwardRequest;