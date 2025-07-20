import dotenv from "dotenv";

import { google } from "@ai-sdk/google";
import { streamText, generateObject } from "ai";
import { z } from "zod";
import { MARKETING_PROMPTS } from "./prompts.js";

dotenv.config();

async function generateMarketingCopy(input) {
  const model = google("gemini-2.5-flash");

  // First step: Generate marketing copy with streaming
  const { textStream: copyStream } = await streamText({
    model,
    system: MARKETING_PROMPTS.CREATIVE_COPYWRITER,
    prompt: `Write persuasive marketing copy for: ${input}. Focus on benefits and emotional appeal.`,
  });

  // Collect the streamed copy
  let copy = "";
  for await (const textPart of copyStream) {
    copy += textPart;
  }

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
    console.log("Quality check failed, regenerating copy.", qualityMetrics);

    const { textStream: improvedCopyStream } = await streamText({
      model,
      system: MARKETING_PROMPTS.COPY_OPTIMIZER,
      prompt: `Rewrite this marketing copy with:
      ${!qualityMetrics.hasCallToAction ? "- A clear call to action" : ""}
      ${qualityMetrics.emotionalAppeal < 7 ? "- Stronger emotional appeal" : ""}
      ${qualityMetrics.clarity < 7 ? "- Improved clarity and directness" : ""}

      Original copy: ${copy}`,
    });
    return { copyStream: improvedCopyStream, qualityMetrics };
  }

  return { copy, qualityMetrics };
}

(async () => {
  const result = await generateMarketingCopy(
    "EcoCharge Pro - Our revolutionary new solar-powered portable charger that keeps your devices powered for up to 7 days. Features dual USB-C ports, wireless charging pad, and weatherproof design. Perfect for outdoor adventures and emergency preparedness."
  );

  if (result.copyStream) {
    console.log("Generated Copy (Improved):");
    for await (const textPart of result.copyStream) {
      process.stdout.write(textPart);
    }
    console.log("\n");
  } else {
    console.log("Generated Copy:", result.copy);
  }

  console.log(
    "Quality Metrics:",
    JSON.stringify(result.qualityMetrics, null, 2)
  );
})();
