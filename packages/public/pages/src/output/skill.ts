import type { PagesConfig } from "../config";
import { toSHA256 } from "../hash";
import type { Catalog } from "./catalog";
import { toLine } from "./markdown";

interface Skill {
  name: string;
  description: string;
  content: string;
}

/** A skill name: lowercase letters, digits, and single hyphens, up to 64 characters. */
const toSkillName = (value: string): string => {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z\d]+/g, "-")
      .slice(0, 64)
      .replace(/^-+|-+$/g, "") || "docs"
  );
};
const readField = (frontmatter: string, name: string): string | undefined => {
  return new RegExp(`^${name}:\\s*(.+)$`, "m")
    .exec(frontmatter)?.[1]
    ?.trim()
    .replace(/^(["'])(.*)\1$/, "$2");
};
/** Reads the name and description of your own skill file, after the agentskills.io format. */
const readSkill = (content: string): Skill => {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(content)?.[1] ?? "";
  const name = readField(frontmatter, "name");
  const description = readField(frontmatter, "description");
  const isValid = name === toSkillName(name ?? "") && !!description;

  if (!isValid) {
    throw new Error(
      "The skill file needs frontmatter with a `name` (lowercase letters, digits, and hyphens) and a `description`."
    );
  }

  return { name, description, content };
};
/**
 * Creates a skill after the agentskills.io format: what the site covers, when to use it, and
 * how to read the documentation.
 */
const createSkill = (config: PagesConfig, catalog: Catalog): Skill => {
  const url = (path: string): string => new URL(`${config.base}${path}`, config.site).href;
  const sections = catalog.sections.filter((section) => section.topics.length);
  const topics = sections.flatMap((section) => section.topics.map((topic) => topic.label));
  const summary = config.description ? `${toLine(config.description)} ` : "";
  const description =
    `${summary}Use when you work with ${toLine(config.name)} or need its documentation${
      topics.length ? `, for example: ${topics.join(", ")}` : ""
    }.`.slice(0, 1024);
  const name = toSkillName(config.name);
  const topicList = sections.map((section) => {
    const links = section.topics.map((topic) => {
      const summary = topic.page.description ? `: ${toLine(topic.page.description)}` : "";

      return `- [${toLine(topic.label)}](${new URL(`${topic.page.href}index.md`, config.site).href})${summary}`;
    });

    return `### ${toLine(section.label)}\n\n${links.join("\n")}`;
  });
  const content = [
    `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---`,
    `# ${toLine(config.name)}`,
    ...(config.description ? [toLine(config.description)] : []),
    [
      "## Read the documentation",
      "",
      `- Find pages in the index: ${url("llms.txt")}`,
      `- Read all pages in one file: ${url("llms-full.txt")}`,
      "- Read one page as Markdown: add `index.md` to its URL, or replace the last `/` with `.md`."
    ].join("\n"),
    ...(topicList.length ? [`## Topics\n\n${topicList.join("\n\n")}`] : []),
    ...(config.agents.instructions ? [`## Instructions\n\n${config.agents.instructions}`] : [])
  ].join("\n\n");

  return { name, description, content: `${content}\n` };
};
/** The skill of the site: your own file, or a generated one. */
const loadSkill = async (
  config: PagesConfig,
  custom: string | undefined,
  loadCatalog: () => Promise<Catalog>
): Promise<Skill> => {
  return custom ? readSkill(custom) : createSkill(config, await loadCatalog());
};
/** The discovery index after the agentskills.io discovery schema 0.2.0. */
const createAgentSkillsIndex = async (config: PagesConfig, skill: Skill): Promise<string> => {
  return JSON.stringify({
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: skill.name,
        type: "skill-md",
        description: skill.description,
        url: `${config.base}.well-known/agent-skills/${skill.name}/SKILL.md`,
        digest: `sha256:${await toSHA256(skill.content)}`
      }
    ]
  });
};
/** The index that the `skills` CLI reads. */
const createSkillsIndex = (skill: Skill): string => {
  return JSON.stringify({
    skills: [{ name: skill.name, description: skill.description, files: ["SKILL.md"] }]
  });
};

export {
  toSkillName,
  readSkill,
  createSkill,
  loadSkill,
  createAgentSkillsIndex,
  createSkillsIndex
};
export type { Skill };
