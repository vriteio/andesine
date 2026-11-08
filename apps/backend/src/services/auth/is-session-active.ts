import { auth } from "#backend/lib/adapters";

/** Doesn't extend the session; an error counts as active, so an outage keeps connections open. */
const isSessionActive = async (input: { headers: Headers }): Promise<boolean> => {
  try {
    const result = await auth.api.getSession({
      headers: input.headers,
      query: { disableRefresh: true }
    });

    return Boolean(result?.session);
  } catch {
    return true;
  }
};

export { isSessionActive };
