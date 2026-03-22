const axios = require("axios");

async function checkServices(services) {

  const results = {};

  for (const service in services) {

    const urls = services[service];

    results[service] = [];

    for (const url of urls) {

      try {

        await axios.get(url);

        results[service].push({
          url,
          status: "UP"
        });

      } catch {

        results[service].push({
          url,
          status: "DOWN"
        });

      }

    }

  }

  return results;

}

module.exports = checkServices;