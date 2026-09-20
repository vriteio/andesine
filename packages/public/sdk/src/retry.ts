const wait = (delay: number, signal: AbortSignal): Promise<void> => {
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delay);

    signal.addEventListener("abort", abort, { once: true });
  });
};
const retryDelay = (attempt: number, response?: Response): number => {
  const value = response?.headers.get("Retry-After");
  const seconds = value === null || value === undefined ? NaN : Number(value);
  const date = value ? Date.parse(value) : NaN;

  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());

  return Math.min(1000 * 2 ** attempt, 30_000) + Math.random() * 250;
};
const fetchWithRetries = async (
  fetcher: typeof fetch,
  request: Request,
  retries: number
): Promise<Response> => {
  const signal = request.signal;

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;

    signal.throwIfAborted();

    try {
      response = await fetcher(request.clone());
    } catch (error) {
      if (signal.aborted || attempt >= retries || !(error instanceof TypeError)) {
        throw error;
      }

      await wait(retryDelay(attempt), signal);
      continue;
    }

    if (attempt >= retries || ![429, 500, 502, 503, 504].includes(response.status)) {
      return response;
    }

    const delay = retryDelay(attempt, response);

    await response.body?.cancel();
    await wait(delay, signal);
  }
};

export { fetchWithRetries };
