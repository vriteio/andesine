import { HeroSection } from "./sections/hero/hero-section";
import { Problems } from "./sections/problems";
import { Workspace } from "./sections/workspace";
import { OpenSource } from "./sections/open-source";
import { CallToAction } from "./sections/call-to-action";
import { SiteFooter } from "./shared/site-footer";
import { links } from "../links";
import { type Component, type JSX } from "solid-js";

interface LandingPageProps {
  header?: JSX.Element;
  ribbon?: JSX.Element;
  publishing?: JSX.Element;
  stars?: number;
}

// Interactive Astro islands enter through slots; static sections stay server-rendered.
const LandingPage: Component<LandingPageProps> = (props) => (
  <div id="top" class="overflow-clip">
    {props.header}
    <main id="main" class="flex flex-col gap-16 md:gap-24">
      <HeroSection
        heading="Your content is everywhere."
        highlight="Bring it together."
        subheading="Docs, knowledge, and structured content in one open-source workspace. Write with your team and AI agents, and publish anywhere."
        secondaryLabel="View on GitHub"
        secondaryLink={links.repository}
        secondaryIcon="i-mdi:github"
        screenshot="/_landing/screenshots/workspace.png"
        screenshotLabel="Andesine workspace"
        ribbon={props.ribbon}
      />
      <Problems />
      <Workspace />
      {props.publishing}
      <OpenSource stars={props.stars} />
      <CallToAction />
    </main>
    <SiteFooter />
  </div>
);

export { LandingPage };
