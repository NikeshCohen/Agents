import dotenv from "dotenv";

import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { CODE_REVIEW_PROMPTS } from "./prompts.js";

dotenv.config();

// Example: Parallel code review with multiple specialized reviewers
async function parallelCodeReview(code) {
  const model = google("gemini-2.5-flash");

  // Run parallel reviews
  const [securityReview, performanceReview, maintainabilityReview] =
    await Promise.all([
      generateObject({
        model,
        system: CODE_REVIEW_PROMPTS.SECURITY_REVIEWER,
        schema: z.object({
          vulnerabilities: z.array(z.string()),
          riskLevel: z.enum(["low", "medium", "high"]),
          suggestions: z.array(z.string()),
        }),
        prompt: `Review this code:
      ${code}`,
      }),

      generateObject({
        model,
        system: CODE_REVIEW_PROMPTS.PERFORMANCE_REVIEWER,
        schema: z.object({
          issues: z.array(z.string()),
          impact: z.enum(["low", "medium", "high"]),
          optimizations: z.array(z.string()),
        }),
        prompt: `Review this code:
      ${code}`,
      }),

      generateObject({
        model,
        system: CODE_REVIEW_PROMPTS.MAINTAINABILITY_REVIEWER,
        schema: z.object({
          concerns: z.array(z.string()),
          qualityScore: z.number().min(1).max(10),
          recommendations: z.array(z.string()),
        }),
        prompt: `Review this code:
      ${code}`,
      }),
    ]);

  const reviews = [
    { ...securityReview.object, type: "security" },
    { ...performanceReview.object, type: "performance" },
    { ...maintainabilityReview.object, type: "maintainability" },
  ];

  // Aggregate results using another model instance
  const { text: summary } = await generateText({
    model,
    system: CODE_REVIEW_PROMPTS.TECHNICAL_LEAD_SYNTHESIZER,
    prompt: `Synthesize these code review results into a concise summary with key actions:
    ${JSON.stringify(reviews, null, 2)}`,
  });

  return { reviews, summary };
}

(async () => {
  const testCode = `
async function processUserData(userData) {
  // Store user credentials in plain text
  const credentials = userData.password;
  
  // Process large arrays synchronously
  const results = userData.items.map(item => {
    return heavyComputation(item);
  });
  
  // Global variable usage
  globalCounter++;
  
  // Nested callbacks
  return new Promise((resolve) => {
    setTimeout(() => {
      database.query(userData, (err, res) => {
        if (err) console.log(err);
        resolve(res);
      });
    }, 1000);
  });
}`;

  const { reviews, summary } = await parallelCodeReview(testCode);
  console.log(
    "Security Review:",
    reviews.find((r) => r.type === "security")
  );
  console.log(
    "Performance Review:",
    reviews.find((r) => r.type === "performance")
  );
  console.log(
    "Maintainability Review:",
    reviews.find((r) => r.type === "maintainability")
  );
  console.log("\nSummary:", summary);
})();
