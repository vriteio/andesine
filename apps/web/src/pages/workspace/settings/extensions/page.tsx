import { type Component } from "solid-js";
import { CatalogSection } from "./catalog-section";
import { InstalledSection } from "./installed-section";

const ExtensionsSettingsPage: Component = () => (
  <>
    <InstalledSection />
    <CatalogSection />
  </>
);

export default ExtensionsSettingsPage;
