// api/routes/GET-orders.ts
import { shopifyFetch } from "../shopify";
import { getErrorMessage, getErrorStack } from "../utils/errors";

const route = async (
	{ request, reply, logger }: { request: any; reply: any; logger: any }
): Promise<void> => {
  try {
    logger.info("Fetching orders from Shopify API");
    
    const data = await shopifyFetch("orders.json?status=any&limit=50");
    
    logger.info("Shopify API response received", { 
      hasData: !!data, 
      hasOrders: !!(data && data.orders),
      orderCount: data && data.orders ? data.orders.length : 0,
      responseKeys: data ? Object.keys(data) : []
    });
    
    if (!data) {
      logger.warn("No data received from Shopify API");
      await reply.code(500).send({ error: "No data received from Shopify API" });
      return;
    }
    
    const orders = data.orders || [];
    logger.info(`Returning ${orders.length} orders`);
    
    await reply.send(orders);
  } catch (error: unknown) {
    logger.error("Error fetching orders from Shopify", { 
      error: getErrorMessage(error), 
      stack: getErrorStack(error), 
    });
    await reply.code(500).send({ 
      error: "Failed to fetch orders", 
      details: getErrorMessage(error), 
    });
  }
};

route.options = {
  cors: {
    origin: true, // Allow requests from any origin - may want to restrict this in production
  },
};

export default route;