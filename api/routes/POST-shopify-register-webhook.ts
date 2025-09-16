import { shopifyFetch } from "../shopify";
import { getErrorMessage } from "../utils/errors";

export default async function handler({ request, reply }: { request: any; reply: any }) {
	try {
		// Ensure webhook exists for orders/create pointing to our route
		const topic = "orders/create";
		const address = `${process.env.PUBLIC_BASE_URL || "https://example.com"}/api/routes/shopify/POST-order-created`;

		const existing = await shopifyFetch("webhooks.json");
		const match = Array.isArray(existing.webhooks)
			? existing.webhooks.find((w: any) => w.topic === topic && w.address)
			: undefined;

		if (!match) {
			await shopifyFetch("webhooks.json", {
				method: "POST",
				body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
			});
		}

		await reply.code(200).send({ ok: true, topic, address, created: !match });
	} catch (error: unknown) {
		await reply.code(500).send({ ok: false, error: getErrorMessage(error) });
	}
}


