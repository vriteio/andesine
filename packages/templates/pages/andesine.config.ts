import { defineConfig } from "@andesine/pages";

const hasKey = process.env.ANDESINE_PUBLIC_KEY || process.env.ANDESINE_API_KEY;
const collection = hasKey && process.env.ANDESINE_COLLECTION_ID;

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
  sections: [
    { id: "guides", label: "Guides", icon: "i-lucide:book-open", sources: ["docs"] },
    { id: "reference", label: "API reference", icon: "i-lucide:braces", sources: ["api"] }
  ],
  sources: [
    collection
      ? { id: "docs", type: "andesine", collection, publicKey: process.env.ANDESINE_PUBLIC_KEY }
      : { id: "docs", type: "files", directory: "src/content/docs" },
    { id: "api", type: "openapi", spec: "src/api/openapi.yaml", mount: "/api/" }
  ]
});
