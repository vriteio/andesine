import type { APIRoute } from "astro";
import config from "virtual:andesine/config";
import { handleAnswer } from "../../search/answers";

export const prerender = false;

export const POST: APIRoute = (context) => {
  let clientAddress: string | undefined;

  // Adapters that do not know the client address throw here; the endpoint then has no limit.
  try {
    clientAddress = context.clientAddress;
  } catch {
    clientAddress = undefined;
  }

  return handleAnswer(context.request, config, clientAddress);
};
