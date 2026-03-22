const axios = require("axios");

const HEALTH_CHECK_TIMEOUT_MS = 3000;

async function checkServices(services) {

  const results = {};

  await Promise.all(
    Object.keys(services).map(async (service) => {

      const urls = services[service];

      results[service] = await Promise.all(
        urls.map(async (url) => {

          try {

            await axios.get(url, { timeout: HEALTH_CHECK_TIMEOUT_MS });

            return { url, status: "UP" };

          } catch {

            return { url, status: "DOWN" };

          }

        })
      );

    })
  );

  return results;

}

module.exports = checkServices;