import { links } from "./links";

interface NavigationLink {
  label: string;
  href: string;
  description?: string;
  icon?: string;
}

interface NavigationSection {
  label: string;
  links: NavigationLink[];
}

interface NavigationGroup {
  label: string;
  links: NavigationLink[];
  sections?: NavigationSection[];
}

const productSections: NavigationSection[] = [
  {
    label: "Create & publish",
    links: [
      { label: "Editor", href: links.product.editor, icon: "i-lucide:files" },
      { label: "Content model", href: links.product.contentModel, icon: "i-tabler:pyramid" },
      { label: "Publishing", href: links.product.publishing, icon: "i-lucide:radio" }
    ]
  },
  {
    label: "Integrate",
    links: [
      {
        label: "AI and agents",
        href: links.product.aiAgents,
        icon: "i-material-symbols:magic-button-outline"
      },
      { label: "API & CLI", href: links.product.developers, icon: "i-lucide:code-xml" },
      { label: "Extensions", href: links.product.extensions, icon: "i-tabler:puzzle" }
    ]
  }
];
const productLinks = productSections.flatMap((section) => section.links);
const useCaseLinks: NavigationLink[] = [
  {
    label: "Documentation",
    href: links.useCases.documentation,
    description: "Product and developer docs, hosted or in GitHub."
  },
  {
    label: "Headless CMS",
    href: links.useCases.headlessCms,
    description: "Blogs, changelogs, and in-app content."
  },
  {
    label: "Knowledge base",
    href: links.useCases.knowledgeBase,
    description: "Team knowledge with access control."
  },
  {
    label: "Agent knowledge",
    href: links.useCases.agentKnowledge,
    description: "One source of truth for your agents."
  }
];
const menuGroups: NavigationGroup[] = [
  { label: "Product", links: productLinks, sections: productSections },
  { label: "Use cases", links: useCaseLinks }
];
const menuLinks: NavigationLink[] = [
  { label: "Open source", href: links.pages.openSource },
  { label: "Pricing", href: links.pages.pricing },
  { label: "Docs", href: links.docs }
];
const footerGroups: NavigationGroup[] = [
  { label: "Product", links: [...productLinks, { label: "Pricing", href: links.pages.pricing }] },
  { label: "Use cases", links: useCaseLinks },
  {
    label: "Resources",
    links: [
      { label: "Docs", href: links.docs },
      { label: "Changelog", href: links.changelog },
      { label: "Source code", href: links.repository },
      { label: "llms.txt", href: links.llms }
    ]
  },
  {
    label: "Company",
    links: [
      { label: "Open source", href: links.pages.openSource },
      { label: "About", href: links.pages.about },
      { label: "Support", href: links.legal.support },
      { label: "Privacy policy", href: links.legal.privacy },
      { label: "Terms of service", href: links.legal.terms }
    ]
  }
];

export {
  menuGroups,
  menuLinks,
  footerGroups,
  type NavigationGroup,
  type NavigationLink,
  type NavigationSection
};
