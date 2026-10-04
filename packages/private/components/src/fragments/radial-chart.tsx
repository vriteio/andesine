import { type Component, createMemo, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { arc, pie, type PieArcDatum } from "d3-shape";
import { nanoid } from "nanoid";

interface RadialChartSegment {
  id: string;
  label: string;
  value: number;
  opacity?: number;
}

interface RadialChartProps {
  segments: RadialChartSegment[];
  /** Value of the full ring; defaults to the segments' sum. */
  max?: number;
  /** In radians; defaults to a full circle. */
  sweep?: number;
  size?: number;
  thickness?: number;
  cornerRadius?: number;
  class?: string;
  center?: (segment: RadialChartSegment | null) => JSX.Element;
  /** Controls the hover, e.g. to share it with a legend. */
  hoveredID?: string | null;
  onHoverChange?(segmentID: string | null): void;
}

const PAD_ANGLE = 0.03;
const HOVER_DELAY = 150;
const FADED_OPACITY = 0.15;

const createDelayedHover = (): [() => string | null, (id: string | null) => void] => {
  const [hoveredID, setHoveredID] = createSignal<string | null>(null);

  let timeout: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => clearTimeout(timeout));

  return [
    hoveredID,
    (id) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setHoveredID(id), HOVER_DELAY);
    }
  ];
};

const RadialChart: Component<RadialChartProps> = (props) => {
  const gradientID = nanoid(8);
  const noisePatternID = nanoid(8);
  const [ownHoveredID, ownHover] = createDelayedHover();
  const size = () => props.size ?? 176;
  const thickness = () => props.thickness ?? 14;
  const sweep = () => props.sweep ?? Math.PI * 2;
  const outerRadius = () => size() / 2 - 2;
  const innerRadius = () => outerRadius() - thickness();
  const total = () => props.segments.reduce((sum, segment) => sum + segment.value, 0);
  const max = () => Math.max(props.max ?? total(), total());
  const ringArc = createMemo(() => {
    return arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(innerRadius())
      .outerRadius(outerRadius())
      .cornerRadius(props.cornerRadius ?? thickness() / 2);
  });
  const trackPath = createMemo(() => {
    return ringArc()({ startAngle: -sweep() / 2, endAngle: sweep() / 2 }) ?? "";
  });
  const segmentArcs = createMemo((): Array<PieArcDatum<RadialChartSegment>> => {
    const filled = max() ? (sweep() * total()) / max() : 0;
    const visible = props.segments.filter((segment) => segment.value > 0);

    return pie<RadialChartSegment>()
      .value((segment) => segment.value)
      .sort(null)
      .startAngle(-sweep() / 2)
      .endAngle(-sweep() / 2 + filled)
      .padAngle(visible.length > 1 ? PAD_ANGLE : 0)(visible);
  });
  const isControlled = () => props.hoveredID !== undefined;
  const hoveredID = () => (isControlled() ? (props.hoveredID ?? null) : ownHoveredID());
  const hover = (id: string | null) => {
    return isControlled() ? props.onHoverChange?.(id) : ownHover(id);
  };
  const hoveredSegment = () => {
    return props.segments.find((segment) => segment.id === hoveredID()) ?? null;
  };

  return (
    <div
      class={props.class}
      style={{ position: "relative", width: `${size()}px`, height: `${size()}px` }}
    >
      <svg width={size()} height={size()} class="block select-none">
        <defs>
          <linearGradient id={gradientID} x1="1" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="var(--color-secondary)" />
            <stop offset="50%" stop-color="var(--color-primary)" />
            <stop offset="100%" stop-color="var(--color-secondary)" />
          </linearGradient>
          <pattern id={noisePatternID} width="96" height="96" patternUnits="userSpaceOnUse">
            <image href="/assets/noise.png" width="96" height="96" />
          </pattern>
        </defs>
        <g transform={`translate(${size() / 2}, ${size() / 2})`}>
          <path d={trackPath()} fill="rgba(156,163,175,0.15)" />
          <For each={segmentArcs()}>
            {(segmentArc) => {
              const path = () => ringArc()(segmentArc) ?? "";
              const opacity = () => {
                if (!hoveredID()) return segmentArc.data.opacity ?? 1;

                return hoveredID() === segmentArc.data.id ? 1 : FADED_OPACITY;
              };

              return (
                <g
                  style={{ opacity: opacity(), transition: "opacity 150ms" }}
                  class="cursor-pointer"
                  onMouseEnter={() => hover(segmentArc.data.id)}
                  onMouseLeave={() => hover(null)}
                >
                  <path d={path()} fill={`url(#${gradientID})`} />
                  <path
                    d={path()}
                    fill={`url(#${noisePatternID})`}
                    pointer-events="none"
                    style={{ "mix-blend-mode": "overlay" }}
                  />
                </g>
              );
            }}
          </For>
        </g>
      </svg>
      <Show when={props.center}>
        {(center) => (
          <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {center()(hoveredSegment())}
          </div>
        )}
      </Show>
    </div>
  );
};

export { createDelayedHover, RadialChart };
export type { RadialChartProps, RadialChartSegment };
