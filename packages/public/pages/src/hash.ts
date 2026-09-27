/** Returns the SHA-256 digest as hex. Web Crypto works in every server runtime. */
const toSHA256 = async (data: string | Uint8Array<ArrayBuffer>): Promise<string> => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export { toSHA256 };
