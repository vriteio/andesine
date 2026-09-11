import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";

const codeLanguages = [
  ...languages,
  LanguageDescription.of({
    name: "Solidity",
    alias: ["sol"],
    extensions: ["sol"],
    load: async () => (await import("@replit/codemirror-lang-solidity")).solidity
  })
];
const findCodeLanguage = (value: string) => {
  const name = value.toLowerCase();

  return codeLanguages.find((language) => {
    return language.name.toLowerCase() === name || language.alias.includes(name);
  });
};
const codeLanguageOptions = [
  { label: "Plain text", value: "plaintext" },
  ...codeLanguages.map((language) => ({ label: language.name, value: language.name.toLowerCase() }))
];

export { codeLanguageOptions, findCodeLanguage };
