import { shopifyFetch } from "../shopify";
import { getErrorMessage } from "../utils/errors";

export default async function handler({ reply }: { reply: any }) {
	try {
		const env = {
			SHOPIFY_STORE_DOMAIN: !!process.env.SHOPIFY_STORE_DOMAIN,
			SHOPIFY_ACCESS_TOKEN: !!process.env.SHOPIFY_ACCESS_TOKEN,
			SHOPIFY_WEBHOOK_SHARED_SECRET: !!process.env.SHOPIFY_WEBHOOK_SHARED_SECRET,
		};

		// Basic shop info to verify credentials
		const shop = await shopifyFetch("shop.json");

		// List webhooks to check for orders/create
		const hooks = await shopifyFetch("webhooks.json");
		const hasOrdersCreate = Array.isArray(hooks.webhooks)
			? hooks.webhooks.some((w: any) => w.topic === "orders/create")
			: false;

		await reply.code(200).send({ ok: true, env, shop: shop?.shop, hasOrdersCreateWebhook: hasOrdersCreate });
	} catch (error: unknown) {
		await reply.code(500).send({ ok: false, error: getErrorMessage(error) });
	}
}


