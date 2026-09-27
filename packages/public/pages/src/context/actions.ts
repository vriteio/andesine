import type { AIService, PagesConfig } from "../config";
import type { PageActionsContext } from "./types";

const services: Record<AIService, { label: string; url: string }> = {
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/?q=" },
  claude: { label: "Claude", url: "https://claude.ai/new?q=" },
  perplexity: { label: "Perplexity", url: "https://www.perplexity.ai/search?q=" }
};

const createPageActions = (
  config: PagesConfig["pageActions"],
  markdownURL: string
): PageActionsContext | undefined => {
  if (!config) return;

  const prompt = encodeURIComponent(`Read ${markdownURL} so I can ask questions about it.`);

  return {
    openIn: config.openIn.map((id) => {
      return {
        id,
        label: services[id].label,
        href: `${services[id].url}${prompt}`
      };
    })
  };
};

export { createPageActions };
