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
export { textResponse };
