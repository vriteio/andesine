import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";
import { config } from "#backend/lib/config";

const ORIGIN_SECRET_HEADER = "x-origin-secret";
const SSR_SECRET_HEADER = "x-ssr-secret";
const VISITOR_IP_HEADER = "x-visitor-ip";

const matchesSecret = (secret: string, value: string | string[] | undefined): boolean => {
  const expected = Buffer.from(secret);
  const received = Buffer.from(String(value ?? ""));

  return expected.length === received.length && timingSafeEqual(expected, received);
};
/** Whether the request has the proxy's origin secret; always true without ORIGIN_SECRET. */
const hasOriginSecret = (headers: FastifyRequest["headers"]): boolean => {
  if (!config.ORIGIN_SECRET) return true;

  return matchesSecret(config.ORIGIN_SECRET, headers[ORIGIN_SECRET_HEADER]);
};
/**
 * The client's IP. Server rendering calls the API from its own address, so it sends the visitor's
 * IP, which counts only with the SSR secret; browsers can't add that one, unlike the origin secret.
 * A proxy's client IP header counts only with the origin secret, which proves the proxy sent it;
 * otherwise the IP comes from the trusted proxies.
 */
const getClientIP = (request: FastifyRequest): string => {
  const visitorIP = String(request.headers[VISITOR_IP_HEADER] ?? "");
  const proxyIP = config.TRUSTED_CLIENT_IP_HEADER
    ? String(request.headers[config.TRUSTED_CLIENT_IP_HEADER] ?? "")
    : "";
  const isServerRendering =
    config.SSR_SECRET && matchesSecret(config.SSR_SECRET, request.headers[SSR_SECRET_HEADER]);
  const isFromProxy = Boolean(config.ORIGIN_SECRET) && hasOriginSecret(request.headers);

  if (isServerRendering && isIP(visitorIP)) return visitorIP;
  if (isFromProxy && isIP(proxyIP)) return proxyIP;

  return request.ip;
};

export { getClientIP, hasOriginSecret, ORIGIN_SECRET_HEADER };
