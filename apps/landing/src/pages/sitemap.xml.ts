import type { APIRoute } from "astro";

const pages = Object.keys(import.meta.glob("./**/*.astro"))
  .filter((file) => !file.includes("["))
  .map((file) => file.replace(/^\.\//, "/").replace(/(index)?\.astro$/, ""))
  .map((path) => (path.endsWith("/") ? path : `${path}/`));

const GET: APIRoute = ({ site }) => {
  const urls = pages.map((path) => `<url><loc>${new URL(path, site)}</loc></url>`).join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { "Content-Type": "application/xml" } }
  );
};

export { GET };
