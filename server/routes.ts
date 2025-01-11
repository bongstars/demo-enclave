import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { priceTriggers, triggerLogs, triggersMet } from "@db/schema";
import { PriceChecker } from "./services/price-checker";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  const priceChecker = PriceChecker.getInstance();
  
  // Start the price checker service
  priceChecker.start();

  // Create trigger endpoint
  app.post("/api/triggers", async (req, res) => {
    try {
      const { fid, walletAddress, tokenAddress, chainId, usdPrice } = req.body;

      // Validate required fields
      if (!fid || !walletAddress || !tokenAddress || !chainId || !usdPrice) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Create new trigger
      const [trigger] = await db.insert(priceTriggers).values({
        fid,
        walletAddress,
        tokenAddress,
        chainId,
        usdPrice,
        interval: 60 // 1 minute in seconds
      }).returning();

      res.status(201).json(trigger);
    } catch (error) {
      console.error("Error creating trigger:", error);
      res.status(500).json({ error: "Failed to create trigger" });
    }
  });

  // Get trigger status
  app.get("/api/triggers/:id", async (req, res) => {
    try {
      const trigger = await db.query.priceTriggers.findFirst({
        where: eq(priceTriggers.id, parseInt(req.params.id))
      });

      if (!trigger) {
        return res.status(404).json({ error: "Trigger not found" });
      }

      const logs = await db.select().from(triggerLogs)
        .where(eq(triggerLogs.triggerId, trigger.id))
        .orderBy(triggerLogs.timestamp);

      const met = await db.select().from(triggersMet)
        .where(eq(triggersMet.triggerId, trigger.id))
        .orderBy(triggersMet.timestamp);

      res.json({
        trigger,
        logs,
        met
      });
    } catch (error) {
      console.error("Error fetching trigger:", error);
      res.status(500).json({ error: "Failed to fetch trigger" });
    }
  });

  return httpServer;
}
