import { publishingChannelCodeType } from "@andesine/contracts/publishing";
import { ORPCError } from "@orpc/server";

const normalizePublishingChannelCode = (code: string): string => {
  const result = publishingChannelCodeType.safeParse(code);

  if (!result.success) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Channel codes must be between 1 and 50 characters"
    });
  }

  return result.data;
};

export { normalizePublishingChannelCode };
