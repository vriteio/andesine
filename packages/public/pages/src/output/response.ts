const textResponse = (body: string | null, type: string, init: ResponseInit = {}): Response => {
  return new Response(body, {
    ...init,
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "X-Content-Type-Options": "nosniff",
      ...init.headers
    }
  });
};
/** Never replace an outage with stale content. */
const unavailableResponse = (error: unknown): Response => {
  console.error(error);

  return textResponse("The documentation is not available now. Try again later.", "text/plain", {
    status: 503,
    headers: { "Retry-After": "30", "Cache-Control": "no-store" }
  });
};

export { textResponse, unavailableResponse };
