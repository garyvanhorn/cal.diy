import { describe, expect, it } from "vitest";

import {
  checkWCAGContrastColor,
  createColorMap,
  getContrastRatio,
  getWCAGContrastColor,
} from "./getBrandColours";

describe("useGetBrandingColours", () => {
  it("should return the correct color values for given lightVal and darkVal", () => {
    const expectedResult = {
      light: {
        "50": "#fff3f3",
        "100": "#ffe8e8",
        "200": "#ffc5c5",
        "300": "#ffa2a2",
        "400": "#ff5c5c",
        "500": "#ff1616",
        "600": "#e61414",
        "700": "#bf1111",
        "800": "#990d0d",
        "900": "#7d0b0b",
      },
      dark: {
        "50": "#f2f5ff",
        "100": "#e6ecff",
        "200": "#bfcfff",
        "300": "#99b3ff",
        "400": "#4d79ff",
        "500": "#0040ff",
        "600": "#003ae6",
        "700": "#0030bf",
        "800": "#002699",
        "900": "#001f7d",
      },
      // ...
    };

    const lightMap = createColorMap("#ff1616");
    const darkMap = createColorMap("#0040ff");

    expect(lightMap).toEqual(expectedResult.light);
    expect(darkMap).toEqual(expectedResult.dark);
  });
});

describe("getWCAGContrastColor", () => {
  it("uses black text on mid-tone orange, where white falls below 4.5:1", () => {
    expect(getContrastRatio("#ff5e1f", "#FFFFFF")).toBeLessThan(4.5);
    expect(getWCAGContrastColor("#ff5e1f")).toBe("#000000");
  });

  it("uses white text on dark brand colours", () => {
    expect(getWCAGContrastColor("#111827")).toBe("#FFFFFF");
    expect(getWCAGContrastColor("#292929")).toBe("#FFFFFF");
  });

  it("uses black text on light brand colours", () => {
    expect(getWCAGContrastColor("#fafafa")).toBe("#000000");
  });
});

describe("checkWCAGContrastColor", () => {
  it("measures contrast with the WCAG formula", () => {
    expect(checkWCAGContrastColor("#ffffff", "#ff5e1f")).toBe(false);
    expect(checkWCAGContrastColor("#ffffff", "#000000")).toBe(true);
  });
});
