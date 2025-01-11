import { db } from "@db";
import { priceTriggers, triggersMet, triggerLogs } from "@db/schema";
import axios from "axios";
import { eq } from "drizzle-orm";

interface GeckoTerminalResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      price_usd: string;
      name: string;
      symbol: string;
    };
  };
}

// Map chain IDs to GeckoTerminal network identifiers
const NETWORK_MAPPING: Record<number, string> = {
  8453: "base", // Base network
  1: "eth", // Ethereum mainnet
  // Add more networks as needed
};

export class PriceChecker {
  private static instance: PriceChecker;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): PriceChecker {
    if (!PriceChecker.instance) {
      PriceChecker.instance = new PriceChecker();
    }
    return PriceChecker.instance;
  }

  async checkPrice(tokenAddress: string, chainId: number): Promise<number> {
    try {
      const networkId = NETWORK_MAPPING[chainId];
      if (!networkId) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
      }

      const response = await axios.get<GeckoTerminalResponse>(
        `https://api.geckoterminal.com/api/v2/networks/${networkId}/tokens/${tokenAddress}`,
      );

      if (!response.data?.data?.attributes?.price_usd) {
        throw new Error("Invalid price data from API");
      }

      return parseFloat(response.data.data.attributes.price_usd);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log(
          `Error fetching price: ${error.message} - ${error.response?.data || "No response data"}`,
        );
      } else {
        console.log(`Error fetching price: ${error}`);
      }
      throw new Error("Failed to fetch price from Gecko Terminal");
    }
  }

  async checkTrigger(triggerId: number): Promise<void> {
    try {
      const trigger = await db.query.priceTriggers.findFirst({
        where: eq(priceTriggers.id, triggerId),
      });

      if (!trigger || !trigger.isActive) return;

      const currentPrice = await this.checkPrice(
        trigger.tokenAddress,
        trigger.chainId,
      );
      const triggerMet =
        currentPrice <= parseFloat(trigger.usdPrice.toString());

      // Log the check - convert currentPrice to string for decimal column
      await db.insert(triggerLogs).values({
        triggerId,
        currentPrice: currentPrice.toString(),
        checkResult: triggerMet,
        timestamp: new Date(),
      });

      // If trigger condition is met
      if (triggerMet) {
        await db.insert(triggersMet).values({
          triggerId,
          currentPrice: currentPrice.toString(),
          timestamp: new Date(),
        });

        // Deactivate the trigger
        await db
          .update(priceTriggers)
          .set({ isActive: false })
          .where(eq(priceTriggers.id, triggerId));

        console.log(`Trigger ${triggerId} met at price ${currentPrice}`);
      }
    } catch (error) {
      console.log(`Error checking trigger ${triggerId}: ${error}`);
    }
  }

  start(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(async () => {
      const activeTriggers = await db
        .select()
        .from(priceTriggers)
        .where(eq(priceTriggers.isActive, true));

      for (const trigger of activeTriggers) {
        await this.checkTrigger(trigger.id);
      }
    }, 60000); // Check every minute
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
