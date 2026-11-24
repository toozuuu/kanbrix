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
  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Kanbrix",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Linux, Docker",
    isAccessibleForFree: true,
    description:
      "Open-source, self-hosted Jira alternative for issue tracking, Kanban boards, and sprint planning.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Custom Kanban workflows and organization templates",
      "Sprint planning and backlog management",
      "Issue forms and required custom fields",
      "Self-hosted Rust API and PostgreSQL storage",
    ],
    ...(process.env.SITE_URL ? { url: process.env.SITE_URL } : {}),
  };
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is Kanbrix a free, open-source Jira alternative?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Kanbrix is open-source issue tracking and project management software you can self-host for free on your own servers or Docker.",
        },
      },
      {
        "@type": "Question",
        name: "How do teams self-host Kanbrix?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Deploy Kanbrix with Docker Compose or run the Rust API binary with PostgreSQL and the React frontend behind your reverse proxy.",
        },
      },
      {
        "@type": "Question",
        name: "Does Kanbrix support Kanban boards, sprints, and custom workflows?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Every project can use organization templates or custom columns, workflow transitions, sprint planning, and custom issue fields.",
        },
      },
    ],
  };
  const serializeLd = (data) => JSON.stringify(data).replaceAll("<", "\\u003c");
  const headTags = [
    `<script type="application/ld+json">${serializeLd(softwareApp)}</script>`,
    `<script type="application/ld+json">${serializeLd(faqPage)}</script>`,
  ];
  let robots = "User-agent: *\nAllow: /\n";
  if (process.env.SITE_URL) {
    const url = new URL(process.env.SITE_URL);
    if (!["https:", "http:"].includes(url.protocol) || url.href !== url.origin + "/") {
      throw new Error("SITE_URL must be the public HTTP(S) origin");
    }
    const website = serializeLd({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Kanbrix",
      url: url.href,
      inLanguage: "en",
    });
    headTags.unshift(
      `<link rel="canonical" href="${url.href}">`,
      `<meta property="og:url" content="${url.href}">`,
      `<meta property="og:image" content="${url.origin}/kanbrix.svg">`,
      `<meta name="twitter:image" content="${url.origin}/kanbrix.svg">`,
      `<script type="application/ld+json">${website}</script>`,
    );
    const lastmod = new Date().toISOString().slice(0, 10);
    await writeFile(
      "dist/sitemap.xml",
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${url.href}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`,
    );
    robots += `Sitemap: ${url.origin}/sitemap.xml\n`;
  }
  home = home.replace("</head>", () => `${headTags.join("\n")}\n</head>`);
  await writeFile("dist/robots.txt", robots);
  const appHtml = shell.includes('name="robots"')
    ? shell.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i, '<meta name="robots" content="noindex, nofollow" />')
    : shell.replace("</head>", '<meta name="robots" content="noindex, nofollow" /></head>');
  await writeFile("dist/app.html", appHtml);
  await writeFile("dist/index.html", home);
} finally {
  await vite.close();
}
