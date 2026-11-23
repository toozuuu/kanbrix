import { readFile, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const shell = await readFile("dist/index.html", "utf8");
const vite = await createServer({
  cacheDir: "node_modules/.vite-prerender",
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: "custom",
  ssr: { resolve: { conditions: ["module", "module-sync", "import"] }, noExternal: ["react-router-dom", "react-router"] },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { StaticRouter } = await vite.ssrLoadModule("react-router-dom");
  const { LandingPage } = await vite.ssrLoadModule("/src/pages/LandingPage.tsx");
  const markup = renderToStaticMarkup(createElement(StaticRouter, { location: "/" }, createElement(LandingPage)));
  let home = shell.replace('<div id="root"></div>', () => `<div id="root">${markup}</div>`);
  let robots = "User-agent: *\nAllow: /\n";
  if (process.env.SITE_URL) {
    const url = new URL(process.env.SITE_URL);
    if (!["https:", "http:"].includes(url.protocol) || url.href !== url.origin + "/") {
      throw new Error("SITE_URL must be the public HTTP(S) origin");
    }
    const website = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Kanbrix",
      url: url.href,
      inLanguage: "en",
    }).replaceAll("<", "\\u003c");
    home = home.replace("</head>", () => [
      `<link rel="canonical" href="${url.href}">`,
      `<meta property="og:url" content="${url.href}">`,
      `<script type="application/ld+json">${website}</script>`,
      "</head>",
    ].join("\n"));
    await writeFile("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${url.href}</loc></url></urlset>`);
    robots += `Sitemap: ${url.origin}/sitemap.xml\n`;
  }
  await writeFile("dist/robots.txt", robots);
  await writeFile("dist/app.html", shell.replace("</head>", '<meta name="robots" content="noindex"></head>'));
  await writeFile("dist/index.html", home);
} finally {
  await vite.close();
}
