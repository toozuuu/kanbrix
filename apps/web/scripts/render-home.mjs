import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { createServer } from "vite";

const pages = process.argv.includes("--pages");
const site = process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined;
if ((pages && !site) || (site && (
  !["https:", "http:"].includes(site.protocol) || site.username || site.password ||
  site.search || site.hash || (!pages && site.pathname !== "/")
))) {
  throw new Error(pages ? "Set SITE_URL to the GitHub Pages URL" : "SITE_URL must be the public HTTP(S) origin");
}

const shell = await readFile("dist/index.html", "utf8");
const vite = await createServer({
  ...(pages ? { mode: "pages" } : {}),
  cacheDir: "node_modules/.vite-prerender",
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: "custom",
  ssr: { resolve: { conditions: ["module", "module-sync", "import"] }, noExternal: ["react-router-dom", "react-router"] },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { StaticRouter } = await vite.ssrLoadModule("react-router-dom");
  const { LandingPage } = await vite.ssrLoadModule("/src/pages/LandingPage.tsx");
  const base = vite.config.base;
  const canonical = site && new URL(base, site);
  const markup = renderToStaticMarkup(createElement(StaticRouter, {
    location: base,
    basename: base,
  }, createElement(LandingPage, { marketingOnly: pages })));
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
    ...(canonical ? { url: canonical.href } : {}),
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
  if (canonical) {
    const image = new URL(pages ? "kanban-board.png" : "kanbrix.svg", canonical).href;
    const website = serializeLd({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Kanbrix",
      url: canonical.href,
      inLanguage: "en",
    });
    headTags.unshift(
      `<link rel="canonical" href="${canonical.href}">`,
      `<meta property="og:url" content="${canonical.href}">`,
      `<meta property="og:image" content="${image}">`,
      `<meta name="twitter:image" content="${image}">`,
      `<script type="application/ld+json">${website}</script>`,
    );
    const paths = [canonical.href];
    if (pages) {
      await copyFile(new URL("../../../docs/screenshots/kanban-board.png", import.meta.url), "dist/kanban-board.png");
      const guideLinks = {
        "INSTALL-KANBRIX.md": "../install/",
        "IMPORT-FROM-JIRA.md": "../import-from-jira/",
        "screenshots/kanban-board.png": "../kanban-board.png",
      };
      for (const guide of [
        { path: "install", file: "INSTALL-KANBRIX.md", title: "Self-host Kanbrix with Docker Compose",
          description: "Install Kanbrix with Docker Compose, create your first project, and check that the app is ready." },
        { path: "import-from-jira", file: "IMPORT-FROM-JIRA.md", title: "Import Jira issues into Kanbrix",
          description: "Preview a Jira import, map workflow statuses, and verify the imported issues on your Kanban board." },
      ]) {
        const url = new URL(guide.path + "/", canonical).href;
        const markdown = await readFile(new URL("../../../docs/" + guide.file, import.meta.url), "utf8");
        const content = renderToStaticMarkup(createElement("main", {
          className: "mx-auto max-w-3xl px-5 py-10",
        },
        createElement("a", { href: base, className: "mb-8 inline-block underline" }, "Kanbrix home"),
        createElement("article", { className: "prose max-w-none dark:prose-invert" },
          createElement(ReactMarkdown, {
            urlTransform: url => guideLinks[url] ?? defaultUrlTransform(url),
          }, markdown),
        )));
        const html = shell
          .replace(/<script type="module"[^>]*><\/script>/g, "")
          .replace(/<link rel="modulepreload"[^>]*>/g, "")
          .replace('<div id="root"></div>', () => content)
          .replace(/<title>[^<]*<\/title>/, `<title>${guide.title} | Kanbrix</title>`)
          .replace(/(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*"/g, `$1${guide.title} | Kanbrix"`)
          .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*"/g, `$1${guide.description}"`)
          .replace("</head>", `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${image}">\n</head>`);
        await mkdir("dist/" + guide.path, { recursive: true });
        await writeFile(`dist/${guide.path}/index.html`, html);
        paths.push(url);
      }
    }
    await writeFile(
      "dist/sitemap.xml",
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(url => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`,
    );
    robots += `Sitemap: ${new URL("sitemap.xml", canonical).href}\n`;
  }
  home = home.replace("</head>", () => `${headTags.join("\n")}\n</head>`);
  await writeFile("dist/robots.txt", robots);
  const appHtml = shell.includes('name="robots"')
    ? shell.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i, '<meta name="robots" content="noindex, nofollow" />')
    : shell.replace("</head>", '<meta name="robots" content="noindex, nofollow" /></head>');
  if (!pages) await writeFile("dist/app.html", appHtml);
  await writeFile("dist/index.html", home);
} finally {
  await vite.close();
}
