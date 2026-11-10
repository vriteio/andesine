import { ScreenshotSection } from "../shared/screenshot-section";
import { type Component } from "solid-js";

// Capture references: 1440 × 820 workspace search screenshot with results;
// 840 × 560 AI answer with linked source citations.
// Use the light theme and sample documents.
const SearchSection: Component = () => (
  <ScreenshotSection
    sectionId="search"
    id="search-title"
    title="Find it. Ask it."
    subtitle="Search content. Get answers."
    detailSide="left"
    main={{
      src: "/_landing/screenshots/workspace-search.png",
      label: "Workspace search results for publishing",
      width: 1440,
      height: 820
    }}
    detail={{
      src: "/_landing/screenshots/answer-with-sources.png",
      label: "An AI answer about publishing a guide with linked source citations",
      width: 840,
      height: 560
    }}
    dots
  >
    <h3 class="text-xl font-medium text-gray-700">An answer you can trace.</h3>
    <p class="mt-2">
      Get AI answers with links to source documents, or search your workspace directly.
    </p>
  </ScreenshotSection>
);

export { SearchSection };
