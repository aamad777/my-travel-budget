export type FeatureFlagName =
  | "newCategoryIcons"
  | "newTravelUi"
  | "newDashboardLayout";

const GLOBAL_FLAGS: Record<FeatureFlagName, boolean> = {
  newCategoryIcons: false,
  newTravelUi: false,
  newDashboardLayout: false,
};

export function isFeatureEnabled(flagName: FeatureFlagName): boolean {
  if (GLOBAL_FLAGS[flagName]) {
    return true;
  }

  if (typeof window !== "undefined") {
    return localStorage.getItem(`feature:${flagName}`) === "true";
  }

  return false;
}
