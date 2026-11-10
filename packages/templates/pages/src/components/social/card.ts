import { html, type SocialCard, type SocialCardData } from "@andesine/pages";
import latin400 from "@fontsource/nunito/files/nunito-latin-400-normal.woff?inline";
import latin600 from "@fontsource/nunito/files/nunito-latin-600-normal.woff?inline";
import latin700 from "@fontsource/nunito/files/nunito-latin-700-normal.woff?inline";
import latinExtended400 from "@fontsource/nunito/files/nunito-latin-ext-400-normal.woff?inline";
import latinExtended600 from "@fontsource/nunito/files/nunito-latin-ext-600-normal.woff?inline";
import latinExtended700 from "@fontsource/nunito/files/nunito-latin-ext-700-normal.woff?inline";
import dots from "../../assets/social-dots.svg?inline";

// Each subset needs its own family name; `font-family` lists them, so later subsets supply the
// characters that earlier ones do not have.
const fonts = [
  { name: "Nunito", data: latin400, weight: 400 },
  { name: "Nunito", data: latin600, weight: 600 },
  { name: "Nunito", data: latin700, weight: 700 },
  { name: "Nunito Extended", data: latinExtended400, weight: 400 },
  { name: "Nunito Extended", data: latinExtended600, weight: 600 },
  { name: "Nunito Extended", data: latinExtended700, weight: 700 }
] as const;
// Satori's `tw` attribute has no `gap` or `line-clamp` classes, so those use `style`.
const clamp = "display: block; line-clamp: 2;";

// Like the app's gradient text: to the top right, with the middle color wider than the text.
const gradientText = (data: SocialCardData): string => {
  return `color: transparent; background-image: linear-gradient(to top right, ${data.brand.secondary}, ${data.brand.primary}, ${data.brand.secondary}); background-size: 125% 100%; background-clip: text;`;
};
// Like the page header, 1.75 times larger: the logo, a bar before the name for full logos, and
// the site name.
const renderLogo = (data: SocialCardData) => {
  const full = data.logoFormat === "full";

  return html`
    <div tw="flex items-center" style="gap: 20px;">
      ${data.logo && html`<img src="${data.logo}" tw="${full ? "h-[45px]" : "h-14 w-14"}" />`}
      ${data.showSiteName && full && html`<div tw="h-[42px] w-1 rounded-sm bg-gray-200"></div>`}
      ${
        data.showSiteName &&
        html`<span tw="${full ? "text-[35px] font-semibold" : "text-[42px] font-bold"}">
          ${data.siteName}
        </span>`
      }
    </div>
  `;
};

/** The image for link previews of each page, 1200 by 630 pixels. */
const card: SocialCard = {
  fonts: () => [...fonts],
  render: (data) => html`
    <div
      tw="relative flex h-[630px] w-[1200px] flex-col justify-between bg-gray-50 px-20 py-[72px] text-gray-900"
      style="font-family: Nunito, Nunito Extended;"
    >
      <img
        src="${data.background ?? dots}"
        tw="absolute inset-0 h-full w-full"
        style="object-fit: cover;"
      />
      ${renderLogo(data)}
      <div tw="flex flex-col" style="gap: 16px;">
        ${
          data.group &&
          html`<span tw="text-[32px] font-bold" style="${gradientText(data)}">${data.group}</span>`
        }
        <span tw="text-[72px] font-bold leading-[1.1]" style="${clamp}">${data.title}</span>
        ${
          data.description &&
          html`<span tw="text-[32px] leading-[1.4] text-gray-500" style="${clamp}">
            ${data.description}
          </span>`
        }
      </div>
    </div>
  `
};

export default card;
