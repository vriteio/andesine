import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { FastifyRequest } from "fastify";
import { config } from "#backend/lib/config";

const ORIGIN_SECRET_HEADER = "x-origin-secret";
const SSR_SECRET_HEADER = "x-ssr-secret";
const VISITOR_IP_HEADER = "x-visitor-ip";
// OAuth-protected endpoints that AI apps call from their own servers; some of those requests reach
// the backend without passing the proxy, so they can't carry the origin secret.
const SERVER_TO_SERVER_PATHS = ["/mcp/", "/.well-known/", "/auth/oauth2/"];

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
const isServerToServerPath = (url: string): boolean => {
  const pathname = url.split("?")[0]!;

  return pathname === "/mcp" || SERVER_TO_SERVER_PATHS.some((path) => pathname.startsWith(path));
};
/** The address that the last proxy saw; earlier forwarded addresses can be faked by the client. */
const getLastHopIP = (request: FastifyRequest): string => {
  const forwarded = String(request.headers["x-forwarded-for"] ?? "").split(",");
  const lastHop = forwarded[forwarded.length - 1]?.trim() ?? "";

  return isIP(lastHop) ? lastHop : request.ip;
};
/**
 * The client's IP. Server rendering calls the API from its own address, so it sends the visitor's
 * IP, which counts only with the SSR secret; browsers can't add that one, unlike the origin secret.
 */
const getClientIP = (request: FastifyRequest): string => {
  const visitorIP = String(request.headers[VISITOR_IP_HEADER] ?? "");
  const isServerRendering =
    config.SSR_SECRET && matchesSecret(config.SSR_SECRET, request.headers[SSR_SECRET_HEADER]);

  if (isServerRendering && isIP(visitorIP)) return visitorIP;

  // Without the proxy in front, only the hosting's own proxy adds a trustworthy address.
  return hasOriginSecret(request.headers) ? request.ip : getLastHopIP(request);
};

export { getClientIP, hasOriginSecret, isServerToServerPath, ORIGIN_SECRET_HEADER };
