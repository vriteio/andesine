import { CardStrip, type StripCard } from "../shared/card-strip";
import {
  ExplorerGraphic,
  FragmentsGraphic,
  PropertyTypesGraphic,
  SchemaGraphic,
  SchemaTypesGraphic,
  SearchFilterGraphic
} from "../shared/feature-graphics/content-model";
import { SectionHeadline } from "../shared/section";
import { type Component } from "solid-js";

const cards: StripCard[] = [
  {
    title: "Folders that make sense.",
    text: "Nest collections as deep as you need.",
    graphic: ExplorerGraphic
  },
  {
    title: "Fields for anything.",
    text: "Text, numbers, dates, tags, and more.",
    graphic: PropertyTypesGraphic
  },
  {
    title: "More than one body.",
    text: "Split an entry into parts, like a summary and the main text.",
    graphic: FragmentsGraphic
  },
  {
    title: "One schema, every entry.",
    text: "Define fields once and apply them to a whole collection.",
    graphic: SchemaGraphic
  },
  {
    title: "Find by any field.",
    text: "Filter search by status, date, or any other field.",
    graphic: SearchFilterGraphic
  },
  {
    title: "Ready for your code.",
    text: "Generate types from your schemas and use them in your app.",
    graphic: SchemaTypesGraphic
  }
];

const ContentModelFeatures: Component = () => (
  <section
    aria-labelledby="content-model-title"
    class="relative flex flex-col gap-6 isolate md:gap-8"
  >
    <div class="mx-auto w-full max-w-5xl px-4 md:px-8">
      <SectionHeadline
        id="content-model-title"
        title="Organized from the start."
        subtitle="And consistent by design."
      />
    </div>
    <CardStrip id="content-model-strip" label="Content model features" cards={cards} />
  </section>
);

export { ContentModelFeatures };
