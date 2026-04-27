const axios = require("axios");
const retryRequest = require("./retry");

const ALLOWED_HEADERS = ["authorization", "cookie", "content-type", "accept"];

async function forwardRequest(req, targetUrl) {

  const headers = {};
  for (const name of ALLOWED_HEADERS) {
    if (req.headers && Object.prototype.hasOwnProperty.call(req.headers, name)) {
      headers[name] = req.headers[name];
    }
  }

  const response = await retryRequest(() =>
    axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers
    })
  );

  return response;
}

module.exports = forwardRequest;