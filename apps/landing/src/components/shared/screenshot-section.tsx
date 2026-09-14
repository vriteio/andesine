import { Section, type SectionProps } from "./section";
import { ScreenshotShowcase, type ScreenshotShowcaseProps } from "./screenshot";
import { type ParentComponent } from "solid-js";

interface ScreenshotSectionProps extends SectionProps, ScreenshotShowcaseProps {}

const ScreenshotSection: ParentComponent<ScreenshotSectionProps> = (props) => (
  <Section
    sectionId={props.sectionId}
    id={props.id}
    title={props.title}
    subtitle={props.subtitle}
    class="relative isolate"
  >
    <ScreenshotShowcase
      main={props.main}
      detail={props.detail}
      detailSide={props.detailSide}
      panel={props.panel}
      dots={props.dots}
    >
      {props.children}
    </ScreenshotShowcase>
  </Section>
);

export { ScreenshotSection };
