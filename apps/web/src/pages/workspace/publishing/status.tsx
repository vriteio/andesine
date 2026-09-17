import { Tooltip } from "@andesine/components";
import {
  type PublishingChannelContentCollection,
  type PublishingChannelContentEntry
} from "#web/lib/data";
import clsx from "clsx";
import { type Component } from "solid-js";

interface PublishingStatusDetails {
  icon: string;
  label: string;
}
interface PublishingStatusIconProps {
  deleted?: boolean;
  label?: string;
  status: PublishingStatus;
}

type PublishingStatus =
  PublishingChannelContentCollection["status"] | PublishingChannelContentEntry["status"];

const STATUS_DETAILS: Record<PublishingStatus, PublishingStatusDetails> = {
  "changes": {
    icon: "i-material-symbols:published-with-changes-rounded text-amber-500",
    label: "Pending changes"
  },
  "pending-publish": {
    icon: "i-material-symbols:publish-rounded text-gray-500",
    label: "Not published"
  },
  "pending-removal": {
    icon: "i-material-symbols:unpublished-outline-rounded text-amber-500",
    label: "Pending removal"
  },
  "published": {
    icon: "i-material-symbols:check-circle-outline-rounded text-green-500",
    label: "Published"
  }
};

const PublishingStatusIcon: Component<PublishingStatusIconProps> = (props) => {
  const details = () => STATUS_DETAILS[props.status];

  return (
    <Tooltip content={props.label || details().label} placement="right" fixed>
      <div class={clsx("h-4.5 w-4.5", details().icon, props.deleted && "!text-red-500")} />
    </Tooltip>
  );
};

export { PublishingStatusIcon };
