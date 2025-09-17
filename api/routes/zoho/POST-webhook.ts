import { getErrorMessage } from "../../utils/errors";
import { findVariantBySKU, setInventoryLevel, updateVariantPrice } from "../../shopify";
import { getZohoItemById } from "../../zoho";
import crypto from "crypto";

const SECRET = process.env.ZOHO_WEBHOOK_SECRET;

function coerceNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : undefined;
}

function extractString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pickSKU(body: any): string | undefined {
  return (
    extractString(body?.sku) ||
    extractString(body?.item_sku) ||
    extractString(body?.item?.sku) ||
    extractString(body?.item?.item_sku)
  );
}

function pickPrice(body: any): number | string | undefined {
  const candidate =
    body?.rate ?? body?.price ?? body?.item?.rate ?? body?.item?.price;
  const n = coerceNumber(candidate);
  return n != null ? n : extractString(candidate);
}

function pickAvailableStock(body: any): number | undefined {
  // Prefer absolute available stock values over deltas
  const absCandidates = [
    body?.available_stock,
    body?.stock_on_hand,
    body?.actual_available_stock,
    body?.quantity_available,
    body?.item?.available_stock,
    body?.item?.stock_on_hand,
    body?.item?.actual_available_stock,
  ];
  for (const c of absCandidates) {
    const n = coerceNumber(c);
    if (n != null) return n;
  }
  // Fallback: treat `quantity` as absolute if present
  const q = coerceNumber(body?.quantity);
  if (q != null) return q;
  return undefined;
}

const handler = async ({ request, reply }: { request: any; reply: any }) => {
  try {
    if (!SECRET) {
      return reply.code(401).send({ ok: false, error: "Unauthorized" });
    }

    // Prefer HMAC signature validation if provided
    const signature = request.headers["x-zoho-webhook-signature"] as string | undefined;
    const rawBody: string | Buffer =
      request.rawBody != null
        ? request.rawBody
        : typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body ?? {});

    let authorized = false;

    if (signature) {
      const bodyBuffer = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
      const computedBase64 = crypto.createHmac("sha256", String(SECRET)).update(bodyBuffer).digest("base64");
      const sigStr = String(signature).trim();
      const a = Buffer.from(sigStr, "base64");
      const b = Buffer.from(computedBase64, "base64");
      if (a.length === b.length) {
        authorized = crypto.timingSafeEqual(a, b);
      } else {
        // Fallback: some systems send hex signatures
        const computedHex = crypto.createHmac("sha256", String(SECRET)).update(bodyBuffer).digest("hex");
        authorized = sigStr.toLowerCase() === computedHex.toLowerCase();
      }
    }

    // Fallback: shared-secret header check
    if (!authorized) {
      const headerSecret =
        (request.headers["x-webhook-secret"] as string | undefined) ||
        (request.headers["x-zoho-webhook-secret"] as string | undefined) ||
        (request.headers["authorization"] as string | undefined)?.replace(/^Bearer\s+/i, "");
      authorized = !!headerSecret && String(headerSecret) === String(SECRET);
    }

    if (!authorized) {
      return reply.code(401).send({ ok: false, error: "Unauthorized" });
    }

    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;

    // Two payload shapes supported:
    // 1) Items payload with direct sku/rate/available_stock
    // 2) Inventory Adjustment payload with line_items[] having item_id and quantity/new_quantity
    const isAdjustment = !!body?.inventory_adjustment;

    if (!isAdjustment) {
      const sku = pickSKU(body);
      if (!sku) {
        return reply.code(200).send({ ok: true, skipped: true, reason: "No SKU in payload" });
      }

      const price = pickPrice(body);
      const available = pickAvailableStock(body);

      const variant = await findVariantBySKU(sku);
      if (!variant) {
        return reply.code(200).send({ ok: true, skipped: true, reason: "SKU not found in Shopify", sku });
      }

      const results: Record<string, unknown> = { sku, variant_id: variant.id };

      if (price != null) {
        try {
          const r = await updateVariantPrice(variant.id, price);
          results.priceUpdated = true;
          results.priceResponse = r;
        } catch (e: unknown) {
          results.priceUpdated = false;
          results.priceError = getErrorMessage(e);
        }
      }

      if (typeof available === "number") {
        try {
          const r = await setInventoryLevel(variant.inventory_item_id, available);
          results.inventoryUpdated = true;
          results.inventoryResponse = r;
        } catch (e: unknown) {
          results.inventoryUpdated = false;
          results.inventoryError = getErrorMessage(e);
        }
      }

      return reply.code(200).send({ ok: true, ...results });
    }

    // Handle Inventory Adjustment payload
    const adj = body.inventory_adjustment || {};
    const lines = Array.isArray(adj.line_items) ? adj.line_items : [];
    const updates: any[] = [];

    for (const li of lines) {
      try {
        const itemId = li?.item_id;
        if (!itemId) { updates.push({ skipped: true, reason: "No item_id" }); continue; }
        const item = await getZohoItemById(itemId);
        const sku = item?.sku as string | undefined;
        if (!sku) { updates.push({ item_id: itemId, skipped: true, reason: "No SKU on item" }); continue; }

        const variant = await findVariantBySKU(sku);
        if (!variant) { updates.push({ item_id: itemId, sku, skipped: true, reason: "SKU not in Shopify" }); continue; }

        // Prefer new_quantity if present; else read current available from the item
        const newQty =
          coerceNumber(li?.new_quantity) ??
          coerceNumber(adj?.new_quantity) ??
          coerceNumber(item?.available_stock ?? item?.stock_on_hand ?? item?.actual_available_stock);
        if (typeof newQty === "number") {
          const r = await setInventoryLevel(variant.inventory_item_id, newQty);
          updates.push({ item_id: itemId, sku, inventoryUpdated: true, inventoryResponse: r });
        } else {
          updates.push({ item_id: itemId, sku, skipped: true, reason: "No absolute quantity" });
        }
      } catch (e: unknown) {
        updates.push({ error: getErrorMessage(e) });
      }
    }

    return reply.code(200).send({ ok: true, inventory_adjustment_id: adj.inventory_adjustment_id, updates });
  } catch (e: unknown) {
    console.error("Zoho webhook handler error:", getErrorMessage(e));
    return reply.code(500).send({ ok: false, error: getErrorMessage(e) });
  }
};

// Enable raw body if Zoho sends as text (not required, but safer for flexibility)
handler.options = {
  config: {
    rawBody: true,
  },
};

export default handler;


