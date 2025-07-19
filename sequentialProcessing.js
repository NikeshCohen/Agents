import dotenv from "dotenv";

import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { MARKETING_PROMPTS } from "./prompts.js";

dotenv.config();

async function generateMarketingCopy(input) {
  const model = google("gemini-2.5-flash");

  // First step: Generate marketing copy
  const { text: copy } = await generateText({
    model,
    system: MARKETING_PROMPTS.CREATIVE_COPYWRITER,
    prompt: `Write persuasive marketing copy for: ${input}. Focus on benefits and emotional appeal.`,
  });

  // Perform quality check on copy
  const { object: qualityMetrics } = await generateObject({
    model,
    schema: z.object({
      hasCallToAction: z.boolean(),
      emotionalAppeal: z.number().min(1).max(10),
      clarity: z.number().min(1).max(10),
    }),
    system: MARKETING_PROMPTS.COPY_EVALUATOR,
    prompt: `Evaluate this marketing copy for:
    1. Presence of call to action (true/false)
    2. Emotional appeal (1-10)
    3. Clarity (1-10)

    Copy to evaluate: ${copy}`,
  });

  // If quality check fails, regenerate with more specific instructions
  if (
    !qualityMetrics.hasCallToAction ||
    qualityMetrics.emotionalAppeal < 7 ||
    qualityMetrics.clarity < 7
  ) {
    const { text: improvedCopy } = await generateText({
      model,
      system: MARKETING_PROMPTS.COPY_OPTIMIZER,
      prompt: `Rewrite this marketing copy with:
      ${!qualityMetrics.hasCallToAction ? "- A clear call to action" : ""}
      ${qualityMetrics.emotionalAppeal < 7 ? "- Stronger emotional appeal" : ""}
      ${qualityMetrics.clarity < 7 ? "- Improved clarity and directness" : ""}

      Original copy: ${copy}`,
    });
    return { copy: improvedCopy, qualityMetrics };
  }

  return { copy, qualityMetrics };
}

(async () => {
  const { copy, qualityMetrics } = await generateMarketingCopy(
    "EcoCharge Pro - Our revolutionary new solar-powered portable charger that keeps your devices powered for up to 7 days. Features dual USB-C ports, wireless charging pad, and weatherproof design. Perfect for outdoor adventures and emergency preparedness."
  );
  console.log("Generated Copy:", copy);
  console.log("Quality Metrics:", JSON.stringify(qualityMetrics, null, 2));
})();
