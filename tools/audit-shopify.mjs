/**
 * Audits the live Shopify shop from its public endpoints — no admin
 * credentials required. Rerun before the final migration delta to see what
 * changed.
 *
 *   bun tools/audit-shopify.mjs            # summary to stdout
 *   bun tools/audit-shopify.mjs --save     # also writes data/shopify-snapshot/
 *
 * Shopify serves /products.json and /collections.json publicly. They expose
 * everything the storefront knows: variants, SKUs, prices, images, option
 * names and body HTML. They do NOT expose barcodes, cost prices, inventory
 * quantities, customers or orders — those need Admin API access.
 */

import { mkdir, writeFile } from "node:fs/promises";

const SHOP = process.env.SHOP_ORIGIN ?? "https://rempireshop.com";
const LOCALES = ["", "/et", "/ru", "/en-lv", "/en-lt"];
const OUT = new URL("../data/shopify-snapshot/", import.meta.url);

const save = process.argv.includes("--save");

async function getJson(path) {
  const res = await fetch(`${SHOP}${path}`, {
    headers: { "User-Agent": "rempire-migration-audit" },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function fetchAllProducts() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const { products } = await getJson(`/products.json?limit=250&page=${page}`);
    if (!products?.length) break;
    all.push(...products);
    if (products.length < 250) break;
  }
  return all;
}

function count(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it) ?? "";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

const products = await fetchAllProducts();
const { collections } = await getJson("/collections.json?limit=250");
const variants = products.flatMap((p) => p.variants ?? []);

const withSku = variants.filter((v) => v.sku?.trim()).length;
const prices = variants.map((v) => Number(v.price)).filter(Number.isFinite);
const onSale = variants.filter((v) => v.compare_at_price).length;
const images = products.map((p) => p.images?.length ?? 0);
const totalImages = images.reduce((a, b) => a + b, 0);
const singleImage = images.filter((n) => n === 1).length;
const noImage = images.filter((n) => n === 0).length;
const multiVariant = products.filter((p) => (p.variants?.length ?? 0) > 1).length;
const withInci = products.filter((p) =>
  /INCI|Ingredient|Состав|Koostis/i.test(p.body_html ?? ""),
).length;
const emptyBody = products.filter((p) => (p.body_html ?? "").length < 20).length;

const brandCollections = collections.filter((c) =>
  c.title === c.title.toUpperCase() && c.title.length > 2,
);
const duplicateTitles = count(collections, (c) => c.title.toLowerCase()).filter(
  ([, n]) => n > 1,
);

const report = {
  shop: SHOP,
  auditedAt: new Date().toISOString(),
  products: products.length,
  variants: variants.length,
  multiVariantProducts: multiVariant,
  skuCoverage: `${withSku}/${variants.length}`,
  priceMin: Math.min(...prices),
  priceMax: Math.max(...prices),
  priceAvg: Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)),
  variantsOnSale: onSale,
  images: { total: totalImages, singleImageProducts: singleImage, noImage },
  content: { withIngredients: withInci, emptyDescriptions: emptyBody },
  collections: collections.length,
  likelyBrandCollections: brandCollections.map((c) => c.title),
  duplicateCollectionTitles: duplicateTitles,
  vendors: count(products, (p) => p.vendor),
  productTypes: count(products, (p) => p.product_type),
  indexableUrlEstimate:
    (products.length + collections.length + 6) * LOCALES.length,
};

console.log(JSON.stringify(report, null, 2));

if (save) {
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL("products.json", OUT), JSON.stringify(products, null, 2));
  await writeFile(new URL("collections.json", OUT), JSON.stringify(collections, null, 2));
  await writeFile(new URL("report.json", OUT), JSON.stringify(report, null, 2));
  console.error(`\nsnapshot written to ${OUT.pathname}`);
}
