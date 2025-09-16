// api/actions/syncZohoToShopify.ts
import { listZohoItemsPaged } from "../zoho";
import { findVariantBySKU, updateVariantPrice, setInventoryLevel } from "../shopify";
import { getErrorMessage } from "../utils/errors";

async function syncZohoToShopify() {
  let page = 1;
  while (true) {
    console.log("Zoho sync: fetching page", page);
    const data = await listZohoItemsPaged(page);
    const items = data.items || [];
    if (!items.length) break;

    for (const item of items) {
      const sku = item.sku;
      if (!sku) continue;

      const variant = await findVariantBySKU(sku);
      if (!variant) continue;

      const zohoPrice = item.rate != null ? String(item.rate) : "";
      if (zohoPrice && variant.price !== zohoPrice) {
        await updateVariantPrice(variant.id, zohoPrice);
      }

      const available =
        (typeof item.available_stock === "number" && item.available_stock) ??
        (typeof item.actual_available_stock === "number" && item.actual_available_stock) ??
        (typeof item.stock_on_hand === "number" && item.stock_on_hand);

      if (typeof available === "number") {
        await setInventoryLevel(variant.inventory_item_id, available);
      }
    }

    if (data.page_context && data.page_context.has_more_page) page += 1;
    else break;
  }
  return { ok: true, message: "Sync complete" };
}

export async function run() {
  try {
    return await syncZohoToShopify();
  } catch (error: unknown) {
    console.error("syncZohoToShopify failed:", getErrorMessage(error));
    throw error;
  }
}