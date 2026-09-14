import { HeroSection } from "./sections/hero/hero-section";
import { Workflow } from "./sections/workflow";
import { EditorSection } from "./sections/editor-section";
import { ContentStructure } from "./sections/content-structure";
import { SearchSection } from "./sections/search-section";
import { TeamSection } from "./sections/team-section";
import { FAQ } from "./sections/faq";
import { CallToAction } from "./sections/call-to-action";
import { SiteFooter } from "./shared/site-footer";
import { type Component, type JSX } from "solid-js";

interface LandingPageProps {
  header?: JSX.Element;
  ribbon?: JSX.Element;
  heading?: JSX.Element;
  publishing?: JSX.Element;
  pricing?: JSX.Element;
}

// Interactive Astro islands enter through slots; static sections stay server-rendered.
const LandingPage: Component<LandingPageProps> = (props) => (
  <div id="top" class="overflow-clip">
    {props.header}
    <main id="main" class="flex flex-col gap-16 md:gap-24">
      <HeroSection heading={props.heading} ribbon={props.ribbon} />
      <Workflow />
      <EditorSection />
      <ContentStructure />
      {props.publishing}
      <SearchSection />
      <TeamSection />
      {props.pricing}
      <FAQ />
      <CallToAction />
    </main>
    <SiteFooter />
  </div>
);

export { LandingPage };
