import { run as runSync } from "../actions/syncZohoToShopify";
import { getErrorMessage } from "../utils/errors";

export default async function handler({ reply }: { reply: any }) {
	try {
		const result = await runSync();
		await reply.code(200).send({ ok: true, result });
	} catch (error: unknown) {
		await reply.code(500).send({ ok: false, error: getErrorMessage(error) });
	}
}


