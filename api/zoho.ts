// api/zoho.ts
const ZOHO_BASE_URL = process.env.ZOHO_BASE_URL;         // https://www.zohoapis.in
const ZOHO_ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL; // https://accounts.zoho.in
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

const requireEnv = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`${name} is not defined`);
  return value;
};

async function getZohoAccessToken(): Promise<string> {
  const accountsUrl = requireEnv(ZOHO_ACCOUNTS_URL, "ZOHO_ACCOUNTS_URL");
  const clientId = requireEnv(ZOHO_CLIENT_ID, "ZOHO_CLIENT_ID");
  const clientSecret = requireEnv(ZOHO_CLIENT_SECRET, "ZOHO_CLIENT_SECRET");
  const refreshToken = requireEnv(ZOHO_REFRESH_TOKEN, "ZOHO_REFRESH_TOKEN");

  const resp = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Zoho token error ${resp.status}: ${body}`);
  }
  const json = await resp.json();
  return json.access_token;
}

async function zohoFetch(path: string, init?: RequestInit): Promise<any> {
  const token = await getZohoAccessToken();
  const baseUrl = requireEnv(ZOHO_BASE_URL, "ZOHO_BASE_URL");
  const orgId = requireEnv(ZOHO_ORG_ID, "ZOHO_ORG_ID");
  const url = new URL(`${baseUrl}/inventory/v1/${path}`);
  url.searchParams.set("organization_id", orgId);
  const resp = await fetch(url.toString(), {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Zoho API ${resp.status}: ${body}`);
  }
  return resp.json();
}

export async function listZohoItemsPaged(page: number = 1) {
  return zohoFetch(`items?page=${page}`);
}

export async function findZohoItemBySKU(sku: string) {
  const data = await zohoFetch(`items?search_text=${encodeURIComponent(sku)}`);
  type ZohoItem = { sku?: string; [key: string]: unknown };
  const items: ZohoItem[] = data.items || [];
  return items.find((i: ZohoItem) => i.sku === sku) || null;
}

export async function getOrCreateZohoContactByEmail(email: string, name?: string) {
  if (!email) throw new Error("Email required");
  const search = await zohoFetch(`contacts?email=${encodeURIComponent(email)}`);
  if (search.contacts?.length) return search.contacts[0];

  const created = await zohoFetch(`contacts`, {
    method: "POST",
    body: JSON.stringify({
      contact_name: name || email.split("@")[0],
      contact_persons: [{ email }],
    }),
  });
  return created.contact;
}

type SalesOrderInput = {
  customerEmail: string;
  customerName?: string;
  referenceNumber?: string;
  lineItems: Array<{ sku: string; rate?: number | string; quantity: number }>;
};

type ZohoLineItem = { item_id: any; name: string; rate: number | string; quantity: number };

export async function createZohoSalesOrder({ customerEmail, customerName, referenceNumber, lineItems }: SalesOrderInput) {
  const contact = await getOrCreateZohoContactByEmail(customerEmail, customerName);
  const zohoLineItems: ZohoLineItem[] = [];
  for (const li of lineItems) {
    const item = await findZohoItemBySKU(li.sku);
    if (!item) throw new Error(`Zoho item not found for SKU ${li.sku}`);
    zohoLineItems.push({
      item_id: item.item_id,
      name: item.name as string,
      rate: li.rate != null ? li.rate : (item.rate as number | string),
      quantity: li.quantity,
    });
  }
  const res = await zohoFetch(`salesorders`, {
    method: "POST",
    body: JSON.stringify({
      customer_id: contact.contact_id,
      reference_number: referenceNumber,
      line_items: zohoLineItems,
    }),
  });
  return res.salesorder;
}

export async function getZohoItemStock(sku: string) {
  const item = await findZohoItemBySKU(sku);
  if (!item) throw new Error(`Zoho item not found for SKU ${sku}`);
  
  // Get detailed item information including stock
  const data = await zohoFetch(`items/${item.item_id}`);
  return {
    sku: data.item.sku,
    name: data.item.name,
    stock_on_hand: data.item.stock_on_hand || 0,
    available_stock: data.item.available_stock || 0,
  };
}

export async function updateZohoItemStock(sku: string, quantityToReduce: number) {
  const item = await findZohoItemBySKU(sku);
  if (!item) throw new Error(`Zoho item not found for SKU ${sku}`);
  
  // Create inventory adjustment to reduce stock
  const res = await zohoFetch(`inventoryadjustments`, {
    method: "POST",
    body: JSON.stringify({
      reason: "Sales Order Stock Reduction",
      adjustment_type: "quantity",
      line_items: [
        {
          item_id: item.item_id,
          quantity_adjusted: -Math.abs(quantityToReduce), // Ensure negative for reduction
        },
      ],
    }),
  });
  
  return res.inventory_adjustment;
}

export async function getZohoItemById(itemId: string | number) {
  const data = await zohoFetch(`items/${itemId}`);
  return data.item;
}