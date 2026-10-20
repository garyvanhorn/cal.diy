import tailwind from "./tailwind.generated.css?inline";

// The CSS is injected into the host page, so the heading font must be fetched from the app's own origin.
const WEBAPP_URL = process.env.EMBED_PUBLIC_WEBAPP_URL || `https://${process.env.EMBED_PUBLIC_VERCEL_URL}`;
const headingFontFace = `@font-face{font-family:"Saira";font-weight:600;font-display:swap;src:url("${WEBAPP_URL}/fonts/saira-semibold.ttf") format("truetype");}`;

export default headingFontFace + tailwind;
