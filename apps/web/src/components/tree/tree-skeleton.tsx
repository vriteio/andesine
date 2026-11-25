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
  list: string;
  row: string;
  icon: string;
  label: string;
}

type TreeSkeletonSize = "medium" | "small";

const sizeClasses: Record<TreeSkeletonSize, TreeSkeletonSizeClasses> = {
  medium: { list: "gap-0.5", row: "gap-1 px-1", icon: "h-6 w-6", label: "h-6" },
  small: { list: "gap-px", row: "gap-1.5 pl-1.25 pr-1", icon: "h-5 w-5 rounded-md", label: "h-5 rounded-md" }
};
const labelWidths = ["w-36", "w-44", "w-32", "w-40"];

const TreeSkeleton: Component<TreeSkeletonProps> = (props) => {
  const size = () => sizeClasses[props.size || "small"];
  const rows = () => Array.from({ length: props.rowCount ?? 4 }, (_, index) => index);

  return (
    <div class={clsx("flex flex-col", size().list)}>
      <For each={rows()}>
      {(index) => (
        <div
          class={clsx("flex items-center", size().row)}
          style={{ height: props.itemHeight || "1.875rem" }}
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
    </div>
  );
};

export { TreeSkeleton };
