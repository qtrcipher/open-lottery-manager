import packageJson from "../../package.json";

export const appVersion = packageJson.version;

export function appVersionLabel(name = "Open Lottery Manager"): string {
  return `${name} v${appVersion}`;
}
