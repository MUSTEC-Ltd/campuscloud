const counters = {};

function getServiceInstance(service, services) {

  if (!counters[service]) {
    counters[service] = 0;
  }

  const instances = services[service];

  const index = counters[service] % instances.length;

  counters[service]++;

  return instances[index];
}

module.exports = getServiceInstance;