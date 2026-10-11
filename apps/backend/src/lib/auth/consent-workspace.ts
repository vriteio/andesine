const getConsentWorkspaceKey = (sessionID: string): string => {
  return `oauth-consent-workspace:${sessionID}`;
};

export { getConsentWorkspaceKey };
