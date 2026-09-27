import type { PagesConfig } from "../config";
import { toHref, toSegments } from "../routing/paths";
import type { SourceData, SourceNode } from "../sources";
import { flattenTree } from "./tree";

interface Section {
  id: string;
  label: string;
  icon?: string;
  /** URL of the first page, or of the first source mount. */
  href: string;
  sources: SourceData[];
  navigation: SourceNode[];
}

const createSection = (
  config: Pick<Section, "id" | "label" | "icon">,
  sources: SourceData[],
  /** Used when no source is loaded, e.g. for request-time sources in a static build. */
  fallbackHref: string
): Section => {
  const navigation = sources.flatMap((source) => source.navigation);
  const href = flattenTree(navigation)[0]?.page?.href ?? sources[0]?.href ?? fallbackHref;

  return { ...config, href, sources, navigation };
};
/** Without configured sections, one implicit section holds all sources. */
const createSections = (config: PagesConfig, sources: SourceData[]): Section[] => {
  const base = toSegments(config.base, "Site base");
  const mountHref = (sourceID?: string): string => {
    const mount = config.sources.find((source) => source.id === sourceID)?.mount ?? "/";

    return toHref(base, toSegments(mount, "Mount"));
  };

  if (!config.sections.length) {
    return [
      createSection({ id: "default", label: config.name }, sources, mountHref(sources[0]?.id))
    ];
  }

  return config.sections.map((section) => {
    return createSection(
      section,
      sources.filter((source) => section.sources.includes(source.id)),
      mountHref(section.sources[0])
    );
  });
};

export { createSections };
export type { Section };
