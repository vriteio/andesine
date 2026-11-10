import { ScreenshotSection } from "../shared/screenshot-section";
import { type Component } from "solid-js";

// Capture references: 1440 × 900 collection schema with status, fields, and fragments;
// 560 × 720 explorer panel with nested collections.
// Use the light theme and sample content.
const EditorSection: Component = () => (
  <ScreenshotSection
    sectionId="editor"
    id="editor-title"
    title="A space to write."
    subtitle="Rich text meets structured content."
    main={{
      src: "/_landing/screenshots/collections-and-schema.png",
      label: "Product updates schema with Category, Status, Summary, and Content",
      width: 1440,
      height: 900
    }}
    detail={{
      src: "/_landing/screenshots/collection-explorer.png",
      label: "Nested documentation collections in the explorer",
      width: 560,
      height: 720,
      imageClass: "aspect-[3/2] object-cover object-top"
    }}
    panel
    dots
  >
    <p>
      Write rich text, add properties, and organize documents into collections. Keep your content
      and its structure in one workspace.
    </p>
  </ScreenshotSection>
);

export { EditorSection };
