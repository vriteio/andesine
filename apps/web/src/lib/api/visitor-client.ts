import type { APIContract } from "@andesine/contracts/api";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { config } from "./config";

/** For share visitors: no workspace header, and no sign-in redirect. */
const createVisitorClient = (token?: string): ContractRouterClient<APIContract> => {
  const link = new RPCLink({
    url: `${config.PUBLIC_API_URL}/rpc`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    fetch: (request, init) => fetch(request, { ...init, credentials: "include" })
  });

  return createORPCClient(link);
};

export { createVisitorClient };
