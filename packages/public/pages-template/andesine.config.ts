import { defineConfig } from "@andesine/pages";

const collection = process.env.ANDESINE_API_KEY && process.env.ANDESINE_COLLECTION_ID;

export default defineConfig({
  name: "Pages",
  description: "Documentation that you own.",
  site: "https://docs.example.com",
  logo: { src: "./src/assets/andesine.svg", format: "full", alt: "Andesine" },
  favicon: "./src/assets/favicon.svg",
  brand: { primary: "#ff3617", secondary: "#f88f52", tertiary: "#fc6335" },
  links: [
    {
      label: "Changelog",
      href: "https://github.com/vriteio/vrite/releases",
      icon: "i-lucide:scroll-text"
    },
    {
      label: "Community",
      href: "https://github.com/vriteio/vrite/discussions",
      icon: "i-lucide:messages-square"
    }
  ],
  cta: { label: "Andesine", href: "https://andesine.app", icon: "i-lucide:arrow-up-right" },
  socialLinks: [
    { label: "GitHub", href: "https://github.com/vriteio/vrite", icon: "i-mdi:github" }
  ],
  sources: [
    collection
      ? { id: "andesine", type: "andesine", collection }
      : { id: "docs", type: "files", directory: "src/content/docs" }
  ]
});
