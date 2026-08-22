/**
 * Builds the complete legacy URL inventory for rempireshop.com and a
 * starting redirect map for the migration.
 *
 *   bun tools/url-inventory.mjs                 # summary
 *   bun tools/url-inventory.mjs --save          # + data/urls/{urls.json,redirects.csv}
 *
 * Every indexable URL on the old shop must end up in one of three states at
 * launch: preserved unchanged, redirected to a named destination, or
 * deliberately retired with a reason. Launching with silent 404s on ranked
 * pages is how SEO-led migrations fail, and organic growth is the stated
 * reason this project exists.
 *
 * Rules encoded here:
 *  - /products/{handle} and /collections/{handle} keep their paths. A tidier
 *    scheme is not worth the ranking risk.
 *  - Locale prefixes /et and /ru are preserved.
 *  - /en-lv and /en-lt are Shopify Markets artefacts. Default proposal is a
 *    301 to the same path on the English default, flagged for a human
 *    decision rather than silently applied.
 */

import { mkdir, writeFile } from "node:fs/promises";

const SHOP = process.env.SHOP_ORIGIN ?? "https://rempireshop.com";
const OUT = new URL("../data/urls/", import.meta.url);
const save = process.argv.includes("--save");

/**
 * Locale prefixes are discovered from the sitemap index rather than
 * hardcoded — the first hand-written list missed en-fi, and Shopify Markets
 * variants can be added by the merchant at any time.
 */
let KNOWN_LOCALES = [];
/** locales we intend to keep serving after launch */
const KEEP_LOCALES = ["et", "ru"];

async function getText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "rempire-migration-audit" },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

const locs = (xml) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replaceAll("&amp;", "&").trim(),
  );

/** split a path into its locale prefix and the rest */
function splitLocale(pathname) {
  const [, first, ...rest] = pathname.split("/");
  if (KNOWN_LOCALES.includes(first)) {
    return { locale: first, path: "/" + rest.join("/") };
  }
  return { locale: "", path: pathname };
}

function classify(path) {
  if (path === "/" || path === "") return "home";
  if (path.startsWith("/products/")) return "product";
  if (path.startsWith("/collections/")) return "collection";
  if (path.startsWith("/blogs/")) return "blog";
  if (path.startsWith("/policies/")) return "policy";
  if (path.startsWith("/pages/")) return "page";
  return "other";
}

/**
 * Decide what happens to a legacy URL at launch.
 * Returns { action, target, note }.
 */
function proposal({ locale, path, kind }) {
  if (locale && !KEEP_LOCALES.includes(locale)) {
    return {
      action: "redirect",
      target: path === "" ? "/" : path,
      note: `DECIDE: ${locale} is a Shopify Markets variant; proposal drops the prefix`,
    };
  }
  const prefix = locale ? `/${locale}` : "";
  if (kind === "policy") {
    return {
      action: "redirect",
      target: `${prefix}${path}`,
      note: "policy text is being rewritten; path preserved",
    };
  }
  return { action: "preserve", target: `${prefix}${path}`, note: "" };
}

const index = await getText(`${SHOP}/sitemap.xml`);
const childSitemaps = locs(index).filter((u) => !u.includes("agentic"));

KNOWN_LOCALES = [
  ...new Set(
    childSitemaps
      .map((u) => new URL(u).pathname.split("/")[1])
      .filter((seg) => seg && !seg.startsWith("sitemap")),
  ),
];
console.error(`locales discovered: ${KNOWN_LOCALES.join(", ") || "(none)"}`);

const rows = [];
const seen = new Set();

for (const sm of childSitemaps) {
  let xml;
  try {
    xml = await getText(sm);
  } catch (err) {
    console.error(`skipped ${sm}: ${err.message}`);
    continue;
  }
  for (const url of locs(xml)) {
    if (seen.has(url)) continue;
    seen.add(url);
    const { pathname } = new URL(url);
    const { locale, path } = splitLocale(pathname);
    const kind = classify(path);
    const { action, target, note } = proposal({ locale, path, kind });
    rows.push({ url, locale: locale || "en", path, kind, action, target, note });
  }
}

// the six policy pages are linked in the footer but absent from the sitemap
for (const slug of [
  "refund-policy",
  "privacy-policy",
  "terms-of-service",
  "shipping-policy",
  "legal-notice",
  "contact-information",
]) {
  for (const locale of ["", ...KEEP_LOCALES]) {
    const path = `/policies/${slug}`;
    const url = `${SHOP}${locale ? "/" + locale : ""}${path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    rows.push({
      url,
      locale: locale || "en",
      path,
      kind: "policy",
      action: "redirect",
      target: `${locale ? "/" + locale : ""}${path}`,
      note: "not in sitemap; linked from footer",
    });
  }
}

const by = (key) =>
  rows.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] ?? 0) + 1), acc), {});

const needsDecision = rows.filter((r) => r.note.startsWith("DECIDE"));

console.log(
  JSON.stringify(
    {
      shop: SHOP,
      builtAt: new Date().toISOString(),
      totalUrls: rows.length,
      byKind: by("kind"),
      byLocale: by("locale"),
      byAction: by("action"),
      needingHumanDecision: needsDecision.length,
    },
    null,
    2,
  ),
);

if (save) {
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL("urls.json", OUT), JSON.stringify(rows, null, 2));
  const csv = [
    "source_url,locale,kind,action,target,note",
    ...rows.map((r) =>
      [r.url, r.locale, r.kind, r.action, r.target, `"${r.note}"`].join(","),
    ),
  ].join("\n");
  await writeFile(new URL("redirects.csv", OUT), csv);
  console.error(`\nwrote ${rows.length} rows to ${OUT.pathname}`);
}
