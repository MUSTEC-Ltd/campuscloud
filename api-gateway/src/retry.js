async function retryRequest(fn, retries = 3) {

  for (let i = 0; i < retries; i++) {

    try {
      return await fn();
    } catch (err) {

      console.log(`Retry ${i + 1} failed`);

      if (i === retries - 1) {
        throw err;
      }

    }

  }

}

module.exports = retryRequest;