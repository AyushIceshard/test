import { listZohoItemsPaged } from "../zoho";
import { getErrorMessage } from "../utils/errors";

export default async function handler({ reply }: { reply: any }) {
  try {
    const env = {
      ZOHO_BASE_URL: !!process.env.ZOHO_BASE_URL,
      ZOHO_ACCOUNTS_URL: !!process.env.ZOHO_ACCOUNTS_URL,
      ZOHO_CLIENT_ID: !!process.env.ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!process.env.ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!process.env.ZOHO_REFRESH_TOKEN,
      ZOHO_ORG_ID: !!process.env.ZOHO_ORG_ID,
    };
    const data = await listZohoItemsPaged(1);
    const itemsCount = (data.items || []).length;
    await reply.code(200).send({ ok: true, itemsCount, env });
  } catch (error: unknown) {
    await reply.code(500).send({ ok: false, error: getErrorMessage(error) });
  }
}