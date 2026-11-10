import { type Component } from "solid-js";
import { ProfileSection } from "./profile-section";
import { SecuritySection } from "./security-section";
import { ConnectedAppsSection } from "./connected-apps-section";
import { AccountDeleteSection } from "./delete-section";

const PersonalSettingsPage: Component = () => (
  <>
    <ProfileSection />
    <SecuritySection />
    <ConnectedAppsSection />
    <AccountDeleteSection />
  </>
);

export default PersonalSettingsPage;
