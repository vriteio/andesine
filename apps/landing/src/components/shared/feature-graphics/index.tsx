import styles from "./styles.module.scss";
import { type Component, type ParentComponent } from "solid-js";
import clsx from "clsx";

interface GraphicProps {
  wide?: boolean;
}

interface DocumentProps {
  x: number;
  y: number;
}

// These diagrams explain features; they are not product screenshots.
const Graphic: ParentComponent<GraphicProps> = (props) => (
  <svg
    viewBox={props.wide ? "0 0 480 240" : "0 0 360 220"}
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class={clsx(styles.graphic, "block h-48 w-full text-gray-300")}
    data-feature-graphic
  >
    {props.children}
  </svg>
);

const Document: Component<DocumentProps> = (props) => (
  <g transform={`translate(${props.x} ${props.y})`}>
    <rect width="72" height="92" rx="10" class="fill-white stroke-gray-300" />
    <path d="M16 23h26M16 38h40M16 50h40M16 62h26" />
  </g>
);

const CollaborationGraphic: Component = () => (
  <Graphic>
    <rect x="58" y="32" width="244" height="160" rx="12" class="fill-white stroke-gray-300" />
    <path d="M84 64h106" class="stroke-gray-500" stroke-width="4" />
    <path d="M84 92h180M84 110h148M84 146h180M84 164h120" />
    <path d="M84 92h108" class="stroke-tertiary/15" stroke-width="12" />
    <g class={clsx(styles.caret, "stroke-tertiary")}>
      <path d="M192 82v20" />
      <rect x="192" y="64" width="42" height="18" rx="4" class="fill-tertiary" stroke="none" />
      <text x="213" y="77" text-anchor="middle" font-size="11" class="fill-white stroke-none">
        Alex
      </text>
    </g>
    <g class={clsx(styles.caret, styles.delay, "stroke-gray-500")}>
      <path d="M204 154v20" />
      <rect x="204" y="174" width="42" height="18" rx="4" class="fill-gray-500" stroke="none" />
      <text x="225" y="187" text-anchor="middle" font-size="11" class="fill-white stroke-none">
        Sam
      </text>
    </g>
    <circle cx="302" cy="42" r="16" class="fill-gray-50 stroke-gray-200" />
    <path d="m296 42 4 4 8-8" pathLength="100" class={clsx(styles.draw, "stroke-tertiary")} />
  </Graphic>
);

const HistoryGraphic: Component = () => (
  <Graphic>
    <path d="M56 174h248" />
    <g class="fill-gray-50 stroke-gray-300">
      <circle cx="76" cy="174" r="5" />
      <circle cx="180" cy="174" r="5" />
      <circle cx="284" cy="174" r="5" />
    </g>
    <circle cx="180" cy="174" r="12" class={clsx(styles.pulse, "stroke-tertiary")} />
    <path d="M180 162v-20" stroke-dasharray="2 4" />
    <rect x="90" y="28" width="180" height="114" rx="12" class="fill-white stroke-gray-300" />
    <path d="M110 51h84M110 69h140" />
    <g class={styles.pulse}>
      <path d="M110 89h116" class="stroke-red-500/10" stroke-width="14" />
      <path d="M110 89h116" class="stroke-red-400" />
    </g>
    <g class={clsx(styles.pulse, styles.delay)}>
      <path d="M110 114h140" class="stroke-green-500/10" stroke-width="14" />
      <path d="M110 114h140" class="stroke-green-500" />
    </g>
    <g class="fill-gray-400 stroke-none" font-size="12" text-anchor="middle">
      <text x="76" y="202">
        01
      </text>
      <text x="180" y="202">
        02
      </text>
      <text x="284" y="202">
        03
      </text>
    </g>
  </Graphic>
);

// Content parts delivered to an application through the API.
const ContentAPIGraphic: Component = () => (
  <Graphic wide>
    <g class={styles.float}>
      <Document x={48} y={74} />
      <rect x="66" y="140" width="82" height="32" rx="6" class="fill-gray-50 stroke-gray-300" />
      <path d="M80 152h16M80 160h48" class="stroke-tertiary" />
    </g>
    <path d="M148 120h166" />
    <path d="M148 120h166" class={clsx(styles.flow, "stroke-tertiary")} />
    <rect x="196" y="96" width="68" height="48" rx="10" class="fill-white stroke-gray-300" />
    <text x="230" y="125" text-anchor="middle" font-size="14" class="fill-gray-500 stroke-none">
      API
    </text>
    <rect x="314" y="58" width="120" height="124" rx="10" class="fill-white stroke-gray-300" />
    <path d="M314 82h120M330 98h60M330 114h88M330 128h70" />
    <rect
      x="330"
      y="146"
      width="40"
      height="18"
      rx="4"
      class={clsx(styles.pulse, "stroke-tertiary")}
    />
    <circle cx="328" cy="70" r="2" class="fill-gray-400 stroke-none" />
    <circle cx="338" cy="70" r="2" class="fill-gray-400 stroke-none" />
  </Graphic>
);

const PublishingGraphic: Component = () => (
  <Graphic wide>
    <path d="M188 120h72M260 120V56q0-10 10-10h50M260 120h60M260 120v64q0 10 10 10h50" />
    <path
      d="M188 120h72M260 120V56q0-10 10-10h50M260 120h60M260 120v64q0 10 10 10h50"
      class={clsx(styles.flow, "stroke-tertiary")}
    />
    <g class={styles.float}>
      <Document x={104} y={66} />
      <rect x="126" y="88" width="72" height="92" rx="10" class="fill-white stroke-gray-300" />
      <path d="M144 112h28M144 128h36M144 140h24" />
      <path d="m148 157 5 5 10-10" class="stroke-tertiary" />
    </g>
    <g class="fill-white stroke-gray-300">
      <rect x="320" y="24" width="108" height="44" rx="9" />
      <rect x="320" y="98" width="108" height="44" rx="9" />
      <rect x="320" y="172" width="108" height="44" rx="9" />
    </g>
    <g class="fill-gray-500 stroke-none" font-size="14" text-anchor="middle">
      <text x="374" y="51">
        Docs
      </text>
      <text x="374" y="125">
        Blog
      </text>
      <text x="374" y="199">
        App
      </text>
    </g>
  </Graphic>
);

const TransformerGraphic: Component = () => (
  <Graphic>
    <Document x={24} y={64} />
    <path d="M96 110h56M152 110V44h54M152 110h54M152 110v66h54" />
    <path
      d="M96 110h56M152 110V44h54M152 110h54M152 110v66h54"
      class={clsx(styles.flow, "stroke-tertiary")}
    />
    <g class="fill-white stroke-gray-300">
      <rect x="206" y="22" width="130" height="44" rx="9" />
      <rect x="206" y="88" width="130" height="44" rx="9" />
      <rect x="206" y="154" width="130" height="44" rx="9" />
    </g>
    <g font-size="16" text-anchor="middle" class="fill-gray-500 stroke-none">
      <text x="271" y="50">
        Markdown
      </text>
      <text x="271" y="116">
        MDX
      </text>
      <text x="271" y="182">
        Custom
      </text>
    </g>
    <circle cx="152" cy="110" r="6" class={clsx(styles.pulse, "fill-tertiary stroke-none")} />
  </Graphic>
);

const GitHubSyncGraphic: Component = () => (
  <Graphic>
    <Document x={24} y={60} />
    <path d="M96 106h80m-8-8 8 8-8 8" class="stroke-tertiary" />
    <path d="M96 106h80" class={clsx(styles.flow, "stroke-tertiary")} />
    <rect x="190" y="28" width="144" height="164" rx="12" class="fill-white stroke-gray-300" />
    <g class="stroke-gray-500">
      <circle cx="216" cy="51" r="4" />
      <circle cx="216" cy="73" r="4" />
      <circle cx="237" cy="51" r="4" />
      <path d="M216 55v14M237 55v3q0 8-8 8h-13" />
    </g>
    <path d="M208 88h108M214 105h12v16h-12zM214 139h12v16h-12z" />
    <g font-size="15" class="fill-gray-500 stroke-none">
      <text x="248" y="65">
        GitHub
      </text>
      <text x="238" y="118">
        .md
      </text>
      <text x="238" y="152">
        .mdx
      </text>
    </g>
    <path d="m292 169 5 5 10-10" class={clsx(styles.pulse, "stroke-tertiary")} />
  </Graphic>
);

const AccessGraphic: Component = () => (
  <Graphic>
    <path d="M80 60h46q18 0 18 18v32M80 160h46q18 0 18-18v-32M144 110h66M242 92V62q0-12 12-12h28M242 128v30q0 12 12 12h28" />
    <path
      d="M80 60h46q18 0 18 18v32h66M242 92V62q0-12 12-12h28"
      class={clsx(styles.flow, "stroke-tertiary")}
    />
    <g class="fill-white stroke-gray-300">
      <circle cx="62" cy="60" r="24" />
      <circle cx="62" cy="160" r="24" />
      <rect x="210" y="82" width="64" height="56" rx="12" />
      <rect x="282" y="30" width="48" height="40" rx="7" />
      <rect x="282" y="150" width="48" height="40" rx="7" />
    </g>
    <circle cx="62" cy="54" r="6" />
    <path d="M50 72q0-12 12-12t12 12M294 47h24M294 57h16M294 167h24M294 177h16" />
    <circle cx="62" cy="154" r="6" />
    <path d="M50 172q0-12 12-12t12 12M235 107v-6a7 7 0 0 1 14 0v6" />
    <rect x="231" y="107" width="22" height="17" rx="4" class="stroke-tertiary" />
    <path d="m298 91 5 5 10-10" class={clsx(styles.pulse, "stroke-tertiary")} />
  </Graphic>
);

const AgentGraphic: Component = () => (
  <Graphic>
    <path d="M180 105V70M148 137H98M212 137h50" />
    <path d="M180 105V70M148 137H98M212 137h50" class={clsx(styles.flow, "stroke-tertiary")} />
    <rect x="130" y="103" width="100" height="68" rx="12" class="fill-white stroke-gray-300" />
    <g class="fill-white stroke-gray-300">
      <rect x="154" y="20" width="52" height="50" rx="10" />
      <rect x="46" y="112" width="52" height="50" rx="10" />
      <rect x="262" y="112" width="52" height="50" rx="10" />
    </g>
    <g class={clsx(styles.pulse, "stroke-tertiary")}>
      <path d="m168 38-5 7 5 7m24-14 5 7-5 7M180 37v16" />
      <path d="M61 132h22M61 142h16M278 129l-5 8 5 8m19-16 5 8-5 8" />
    </g>
    <g class="fill-gray-500 stroke-none" text-anchor="middle" font-size="15">
      <text x="180" y="143">
        MCP
      </text>
    </g>
    <path d="M180 171v20M168 191h24" stroke-dasharray="2 5" />
  </Graphic>
);

export {
  CollaborationGraphic,
  HistoryGraphic,
  ContentAPIGraphic,
  PublishingGraphic,
  TransformerGraphic,
  GitHubSyncGraphic,
  AccessGraphic,
  AgentGraphic
};
