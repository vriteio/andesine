import { createChannel } from "./create";
import { deleteChannel } from "./delete";
import { getChannelContent } from "./get-content";
import { listChannels } from "./list";

const Channels = {
  create: createChannel,
  delete: deleteChannel,
  getContent: getChannelContent,
  list: listChannels
};

export { Channels };
