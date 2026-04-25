// Only retry on network errors or 5xx responses — never on 4xx client errors
async function retryRequest(fn, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      const status = err?.response?.status;

      // Don't retry client errors (4xx) — they won't change on retry
      if (status && status >= 400 && status < 500) {
        throw err;
      }

      if (attempt === retries - 1) {
        throw err;
      }

      console.log(`Retry ${attempt + 1}/${retries - 1} (status: ${status ?? "network error"})`);
    }
  }
}

module.exports = retryRequest;
