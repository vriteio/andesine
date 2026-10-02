import { type Component } from "solid-js";
import { ChannelsSection } from "./channels-section";
import { SitesSection } from "./sites-section";

const PublishingSettingsPage: Component = () => (
  <>
    <ChannelsSection />
    <SitesSection />
  </>
);

export default PublishingSettingsPage;
