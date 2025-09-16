// api/actions/pushShopifyOrderToZoho.ts
import { createZohoSalesOrder, findZohoItemBySKU } from "../zoho";

type ShopifyOrderLineItemLite = {
	sku?: string;
	quantity?: number;
	price?: number | string;
};

type ShopifyOrderLite = {
	id?: number | string;
	email?: string;
	customer?: { email?: string; first_name?: string; last_name?: string };
	billing_address?: { name?: string };
	line_items?: ShopifyOrderLineItemLite[];
};

export async function pushShopifyOrderToZoho(order: ShopifyOrderLite) {
  const email = order?.email || order?.customer?.email;
  if (!email) { console.warn("SO skip: no email", { orderId: order?.id }); return; }

  const lineItems: Array<{ sku: string; quantity: number; rate?: number | string }> = [];
  for (const li of order?.line_items || []) {
    if (!li?.sku) { console.error("SO skip line: missing SKU"); continue; }
    if (typeof li.quantity !== 'number') { console.error("SO skip line: invalid quantity", { sku: li.sku, quantity: li.quantity }); continue; }
    console.log("SO line", { sku: li.sku, qty: li.quantity });
    const item = await findZohoItemBySKU(li.sku);
    if (!item) { console.error("SO skip line: SKU not in Zoho", li.sku); continue; }
    lineItems.push({ sku: li.sku, quantity: li.quantity, rate: li.price });
  }
  if (!lineItems.length) { console.warn("SO skip: no mapped lines", { orderId: order?.id }); return; }

  const so = await createZohoSalesOrder({
    customerEmail: email,
    customerName: [order?.customer?.first_name, order?.customer?.last_name].filter(Boolean).join(" ") || order?.billing_address?.name,
    referenceNumber: String(order.id),
    lineItems,
  });
  console.log("SO created", { orderId: order?.id, salesorder_id: so?.salesorder_id, salesorder_number: so?.salesorder_number });
  return so;
}

export async function run(params: { order?: ShopifyOrderLite }) {
  return await pushShopifyOrderToZoho(params?.order || {});
}