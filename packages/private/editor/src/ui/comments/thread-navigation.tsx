import type { Component } from "solid-js";
import { IconButton, Shortcut, Tooltip } from "@andesine/components";

interface ThreadNavigationProps {
  index: number;
  count: number;
  onStep(step: number): void;
}

const STEPS = [
  { step: -1, label: "Previous thread", icon: "i-lucide:chevron-left", key: "←" },
  { step: 1, label: "Next thread", icon: "i-lucide:chevron-right", key: "→" }
];

const ThreadNavigation: Component<ThreadNavigationProps> = (props) => {
  const button = (step: (typeof STEPS)[number]) => {
    return (
      <Tooltip
        content={
          <div class="flex flex-col items-center justify-center gap-0.5">
            <span>{step.label}</span>
            <Shortcut class="opacity-50 font-mono text-[80%]" shortcut={step.key} />
          </div>
        }
        placement="bottom"
      >
        <IconButton
          icon={step.icon}
          variant="ghost"
          text="soft"
          size="xs"
          aria-label={step.label}
          onClick={() => props.onStep(step.step)}
        />
      </Tooltip>
    );
  };

  return (
    <div class="flex items-center gap-0.5">
      {button(STEPS[0])}
      <span class="font-mono text-xs text-gray-400">{`${props.index + 1}/${props.count}`}</span>
      {button(STEPS[1])}
    </div>
  );
};

export { ThreadNavigation };
