// api/shopify.ts
const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = "2025-07";
const FALLBACK_LOCATION_ID = process.env.DEFAULT_LOCATION_ID; // optional secret

const requireEnv = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`${name} is not defined`);
  return value;
};

function shopifyURL(path: string): string {
  const domain = requireEnv(SHOPIFY_DOMAIN, "SHOPIFY_STORE_DOMAIN");
  return `https://${domain}/admin/api/${API_VERSION}/${path}`;
}

export async function shopifyFetch(path: string, init?: RequestInit): Promise<any> {
  const token = requireEnv(SHOPIFY_TOKEN, "SHOPIFY_ACCESS_TOKEN");
  const resp = await fetch(shopifyURL(path), {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init && init.headers ? init.headers : {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Shopify ${resp.status}: ${body}`);
  }
  return resp.json();
}

export async function findVariantBySKU(sku: string) {
  const data = await shopifyFetch(`variants.json?sku=${encodeURIComponent(sku)}`);
  const variants = (data.variants || []) as Array<{ sku?: string }>;
  const exact = variants.find((v) => v.sku === sku);
  return (exact as any) || (variants[0] as any) || null;
}

export async function getPrimaryLocationId(): Promise<number> {
  const data = await shopifyFetch("shop.json");
  const id = data?.shop?.primary_location_id;
  if (id) return id;
  if (FALLBACK_LOCATION_ID) return Number(FALLBACK_LOCATION_ID);
  throw new Error("primary_location_id unavailable; set DEFAULT_LOCATION_ID or ensure item has inventory_levels");
}

async function getLocationIdForItem(inventoryItemId: number | string): Promise<number> {
  try {
    return await getPrimaryLocationId();
  } catch {
    // fallback: take the first existing level’s location (requires read_inventory, not read_locations)
    const levels = await shopifyFetch(`inventory_levels.json?inventory_item_ids=${inventoryItemId}`);
    const loc = levels?.inventory_levels?.[0]?.location_id;
    if (loc) return loc;
    if (FALLBACK_LOCATION_ID) return Number(FALLBACK_LOCATION_ID);
    throw new Error("No location_id available; set DEFAULT_LOCATION_ID in Secrets");
  }
}

export async function updateVariantPrice(variantId: number | string, price: number | string) {
  return shopifyFetch(`variants/${variantId}.json`, {
    method: "PUT",
    body: JSON.stringify({ variant: { id: variantId, price: String(price) } }),
  });
}

export async function setInventoryLevel(
  inventoryItemId: number | string,
  available: number,
  locationId?: number
) {
  const locId = locationId || (await getLocationIdForItem(inventoryItemId));
  return shopifyFetch(`inventory_levels/set.json`, {
    method: "POST",
    body: JSON.stringify({
      location_id: locId,
      inventory_item_id: inventoryItemId,
      available,
    }),
  });
}