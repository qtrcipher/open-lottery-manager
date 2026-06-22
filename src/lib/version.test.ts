import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import { appVersion, appVersionLabel } from "./version";

describe("app version helpers", () => {
  it("uses package metadata as the version source", () => {
    expect(appVersion).toBe(packageJson.version);
  });

  it("formats a public version label", () => {
    expect(appVersionLabel()).toBe(`Open Lottery Manager v${packageJson.version}`);
  });
});
