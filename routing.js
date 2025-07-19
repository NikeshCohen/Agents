import dotenv from "dotenv";

import { google } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { CUSTOMER_SERVICE_PROMPTS } from "./prompts.js";

dotenv.config();

async function handleCustomerQuery(query) {
  const model = google("gemini-2.5-flash");

  // First step: Classify the query type
  const { object: classification } = await generateObject({
    model,
    schema: z.object({
      reasoning: z.string(),
      type: z.enum(["general", "refund", "technical"]),
      complexity: z.enum(["simple", "complex"]),
    }),
    system: CUSTOMER_SERVICE_PROMPTS.QUERY_CLASSIFIER,
    prompt: `Classify this customer query:
    ${query}

    Determine:
    1. Query type (general, refund, or technical)
    2. Complexity (simple or complex)
    3. Brief reasoning for classification`,
  });

  // Route based on classification
  // Set model and system prompt based on query type and complexity
  const { text: response } = await generateText({
    model:
      classification.complexity === "simple"
        ? google("gemini-2.5-flash")
        : google("gemini-2.5-pro"),
    system: {
      general: CUSTOMER_SERVICE_PROMPTS.GENERAL_SUPPORT,
      refund: CUSTOMER_SERVICE_PROMPTS.REFUND_SPECIALIST,
      technical: CUSTOMER_SERVICE_PROMPTS.TECHNICAL_SUPPORT,
    }[classification.type],
    prompt: query,
  });

  return { response, classification };
}

(async () => {
  const testQueries = [
    "I've been trying to connect my EcoCharge Pro to my phone for the past hour but it's not showing up in the Bluetooth devices list. I've already tried restarting both devices and checking if Bluetooth is enabled. Can you help me troubleshoot this issue?",
    "I received my order yesterday but the charging pad isn't working as advertised. I'd like to return it and get a refund. Order #EC-2024-03-15-789",
    "Hi, I'm interested in buying the EcoCharge Pro. Does it work with iPhone 15 Pro Max? Also, what's the warranty period?",
  ];

  for (const query of testQueries) {
    console.log("\n--- New Query ---");
    console.log("Query:", query);
    const { response, classification } = await handleCustomerQuery(query);
    console.log("Classification:", classification);
    console.log("Response:", response);
  }
})();
