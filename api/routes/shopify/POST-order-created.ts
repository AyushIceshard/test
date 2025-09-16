// api/routes/shopify/POST-order-created.ts
import crypto from "crypto";
import { pushShopifyOrderToZoho } from "../../actions/pushShopifyOrdersToZoho";
import { getErrorMessage } from "../../utils/errors";

const SHOPIFY_SECRET = process.env.SHOPIFY_WEBHOOK_SHARED_SECRET;
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

function verifyHmac(hmacHeader: string | undefined, rawBody: string | Buffer) {
  if (!hmacHeader || !SHOPIFY_SECRET) return false;
  const bodyBuffer = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const computed = crypto.createHmac("sha256", SHOPIFY_SECRET)
    .update(bodyBuffer)
    .digest("base64");
  const a = Buffer.from(hmacHeader, "base64");
  const b = Buffer.from(computed, "base64");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const handler = async ({ request, reply }: { request: any; reply: any }) => {
  try {
    const hmac = request.headers["x-shopify-hmac-sha256"];
    
    // Try to get raw body for HMAC verification in order of preference
    let rawBody;
    if (request.rawBody != null) {
      rawBody = request.rawBody;
      console.log("Using request.rawBody for HMAC");
    } else if (typeof request.body === 'string') {
      rawBody = request.body;
      console.log("Using string request.body for HMAC");
    } else {
      // Last resort: stringify the parsed body (not ideal but better than failing)
      rawBody = JSON.stringify(request.body);
      console.log("Using JSON.stringify fallback for HMAC - may cause verification issues");
    }
    
    // Development bypass for HMAC verification
    let hmacValid = false;
    if (IS_DEVELOPMENT && !hmac) {
      console.warn("Development mode: Bypassing HMAC verification (no header)");
      hmacValid = true;
    } else if (IS_DEVELOPMENT) {
      hmacValid = verifyHmac(hmac, rawBody);
      if (!hmacValid) {
        console.warn("Development mode: HMAC failed but continuing anyway");
        hmacValid = true; // Override for development
      }
    } else {
      hmacValid = verifyHmac(hmac, rawBody);
    }
    
    if (!hmacValid) {
      console.error("HMAC verification failed", { 
        hasHmac: !!hmac, 
        hasSecret: !!SHOPIFY_SECRET,
        bodyType: typeof rawBody,
        bodyLength: rawBody?.length,
        isDevelopment: IS_DEVELOPMENT
      });
      return reply.code(401).send("Invalid HMAC");
    }

    // Parse the order data
    const order = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const email = order?.email || order?.customer?.email;
    
    if (email) {
      console.log("Processing order", { id: order?.id, email });
      await pushShopifyOrderToZoho(order);
      console.log("Order processed successfully", { id: order?.id });
    } else {
      console.warn("Skipping order - no email", { id: order?.id });
    }
    
    return reply.code(200).send("OK");
  } catch (error: unknown) {
    console.error("order-created processing error:", getErrorMessage(error));
    return reply.code(500).send("Internal Server Error");
  }
};

// Configure route to receive raw body for HMAC verification
handler.options = {
  config: {
    rawBody: true
  }
};

export default handler;