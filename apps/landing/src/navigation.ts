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
      { label: "Pages", href: links.product.pages, icon: "i-lucide:globe" }
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
    label: "Product docs",
    href: links.useCases.documentation,
    description: "Product and developer docs, hosted or in GitHub."
  },
  {
    label: "Headless CMS",
    href: links.useCases.headlessCms,
    description: "Blogs, changelogs, and in-app content."
  },
  {
    label: "Team knowledge base",
    href: links.useCases.knowledgeBase,
    description: "Team knowledge with access control."
  },
  {
    label: "Centralized hub",
    href: links.useCases.centralHub,
    description: "One source for your agents and apps."
  }
];
const menuGroups: NavigationGroup[] = [
  { label: "Product", links: productLinks, sections: productSections },
  { label: "Use cases", links: useCaseLinks }
];
const menuLinks: NavigationLink[] = [
  { label: "Pricing", href: links.pages.pricing },
  { label: "Documentation", href: links.docs }
];
const footerGroups: NavigationGroup[] = [
  { label: "Product", links: [...productLinks, { label: "Pricing", href: links.pages.pricing }] },
  { label: "Use cases", links: useCaseLinks },
  {
    label: "Resources",
    links: [
      { label: "Documentation", href: links.docs },
      { label: "Changelog", href: links.changelog },
      { label: "Source code", href: links.repository },
      { label: "llms.txt", href: links.llms }
    ]
  },
  {
    label: "Company",
    links: [
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
