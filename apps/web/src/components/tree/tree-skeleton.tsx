import { Skeleton } from "@andesine/components";
import clsx from "clsx";
import { type Component, For } from "solid-js";

interface TreeSkeletonProps {
  fullWidth?: boolean;
  itemHeight?: string;
  rowCount?: number;
  size?: TreeSkeletonSize;
}
interface TreeSkeletonSizeClasses {
  gap: string;
  icon: string;
  label: string;
}

type TreeSkeletonSize = "medium" | "small";

const sizeClasses: Record<TreeSkeletonSize, TreeSkeletonSizeClasses> = {
  medium: { gap: "gap-1", icon: "h-6 w-6", label: "h-6" },
  small: { gap: "gap-1.5", icon: "h-5 w-5 rounded-md", label: "h-5 rounded-md" }
};
const labelWidths = ["w-36", "w-44", "w-32", "w-40"];

const TreeSkeleton: Component<TreeSkeletonProps> = (props) => {
  const size = () => sizeClasses[props.size || "small"];
  const rows = () => Array.from({ length: props.rowCount ?? 4 }, (_, index) => index);

  return (
    <For each={rows()}>
      {(index) => (
        <div
          class={clsx("flex items-center px-1", size().gap)}
          style={{ height: props.itemHeight || "1.75rem" }}
        >
          <Skeleton
            class={[
              size().icon,
              clsx(
                size().label,
                props.fullWidth ? "flex-1" : labelWidths[index % labelWidths.length]
              )
            ]}
          />
        </div>
      )}
    </For>
  );
};

export { TreeSkeleton };
