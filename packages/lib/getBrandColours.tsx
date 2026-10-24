import { useBrandColors } from "@calcom/embed-core/embed-iframe";

import { DEFAULT_DARK_BRAND_COLOR, DEFAULT_LIGHT_BRAND_COLOR } from "./constants";

const BRAND_COLOR = DEFAULT_LIGHT_BRAND_COLOR;
const DARK_BRAND_COLOR = DEFAULT_DARK_BRAND_COLOR;

type Rgb = {
  r: number;
  g: number;
  b: number;
};

/**
 * Given a html color name, check if it exists in our color palette
 * and if it does, return the hex code for that color. Otherwise,
 * return the default brand color.
 */
export function fallBackHex(val: string | null, dark: boolean): string {
  if (val && isValidHexCode(val)) {
    return val;
  }
  return dark ? DARK_BRAND_COLOR : BRAND_COLOR;
}

export function isValidHexCode(hexColor: string): boolean {
  // Regular expression for hex color code pattern
  const hexColorPattern = /^#([0-9A-Fa-f]{3}){1,2}$/;

  // Check if hex color code matches pattern
  const isHexColor = hexColorPattern.test(hexColor);

  return isHexColor;
}

// credit : https://github.com/validatorjs/validator.js/blob/master/src/lib/isHexColor.js
const getValidHEX = (hex: string, defaultHex: string): string => {
  const hexColor = /^#?([0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(hex.replace("##", "#"));
  if (hexColor) {
    return hex;
  }
  return defaultHex;
};

function hexToRgb(hex: string): Rgb {
  const sanitizedHex = hex.replace("##", "#");
  const colorParts = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(sanitizedHex);

  if (!colorParts) {
    throw new Error("Invalid Hex colour");
  }

  const [, r, g, b] = colorParts;

  return {
    r: parseInt(r, 16),
    g: parseInt(g, 16),
    b: parseInt(b, 16),
  } as Rgb;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => `0${c.toString(16)}`.slice(-2);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lighten(hex: string, intensity: number): string {
  const color = hexToRgb(`#${hex}`);

  if (!color) {
    return "";
  }

  const r = Math.round(color.r + (255 - color.r) * intensity);
  const g = Math.round(color.g + (255 - color.g) * intensity);
  const b = Math.round(color.b + (255 - color.b) * intensity);

  return rgbToHex(r, g, b);
}

function darken(hex: string, intensity: number): string {
  const color = hexToRgb(hex);

  if (!color) {
    return "";
  }

  const r = Math.round(color.r * intensity);
  const g = Math.round(color.g * intensity);
  const b = Math.round(color.b * intensity);

  return rgbToHex(r, g, b);
}

function normalizeHexCode(hex: string | null, dark: boolean) {
  if (!hex) {
    return !dark ? BRAND_COLOR : DARK_BRAND_COLOR;
  }

  hex = hex.replace("#", "");

  // If the length of the hex code is 3, double up each character
  // e.g. fff => ffffff or a0e => aa00ee
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map(function (hex) {
        return hex + hex;
      })
      .join("");
  }

  return hex;
}

export const createColorMap = (brandColor: string) => {
  const response: Record<string, string> = {
    500: `#${brandColor}`.replace("##", "#"),
  };
  const intensityMap: {
    [key: number]: number;
  } = {
    50: 0.95,
    100: 0.9,
    200: 0.75,
    300: 0.6,
    400: 0.3,
    600: 0.9,
    700: 0.75,
    800: 0.6,
    900: 0.49,
  };

  [50, 100, 200, 300, 400].forEach((level) => {
    response[level] = lighten(brandColor, intensityMap[level]);
  });

  [600, 700, 800, 900].forEach((level) => {
    response[level] = darken(brandColor, intensityMap[level]);
  });
  return response;
};

// WCAG 2.x relative luminance; a plain weighted RGB average misjudges mid-tone colours.
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function getContrastRatio(colorA: string, colorB: string): number {
  const a = relativeLuminance(colorA);
  const b = relativeLuminance(colorB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Picks whichever of white or black reads better on the background. */
export function getWCAGContrastColor(background: string): string {
  return getContrastRatio(background, "#FFFFFF") >= getContrastRatio(background, "#000000")
    ? "#FFFFFF"
    : "#000000";
}

export function checkWCAGContrastColor(background: string, target: string) {
  const MIN_CONTRAST_RATIO = 4.5; // used for BGs

  return getContrastRatio(background, target) >= MIN_CONTRAST_RATIO;
}

/**
 * Given a light and dark brand color value, update the css variables
 * within the document to reflect the new brand colors.
 */
const useGetBrandingColours = ({
  lightVal = BRAND_COLOR,
  darkVal = DARK_BRAND_COLOR,
}: {
  lightVal: string | undefined | null;
  darkVal: string | undefined | null;
}) => {
  const embedBrandingColors = useBrandColors();

  lightVal = embedBrandingColors.brandColor || lightVal;

  // convert to 6 digit equivalent if 3 digit code is entered
  lightVal = normalizeHexCode(lightVal, false);

  darkVal = normalizeHexCode(darkVal, true);

  const lightColourMap = createColorMap(getValidHEX(lightVal, BRAND_COLOR));
  const darkColourMap = createColorMap(getValidHEX(darkVal, DARK_BRAND_COLOR));

  const theme = {
    light: {
      "cal-brand": lightColourMap["500"],
      "cal-brand-emphasis": lightColourMap["400"],
      "cal-brand-subtle": lightColourMap["200"],
      "cal-brand-text": getWCAGContrastColor(lightColourMap["500"]),
      "cal-brand-accent": getWCAGContrastColor(lightColourMap["500"]),
    },
    dark: {
      "cal-brand": darkColourMap["500"],
      "cal-brand-emphasis": darkColourMap["600"],
      "cal-brand-subtle": darkColourMap["800"],
      "cal-brand-text": getWCAGContrastColor(darkColourMap["500"]),
      "cal-brand-accent": getWCAGContrastColor(darkColourMap["500"]),
    },
  };
  return theme;
};

export default useGetBrandingColours;
