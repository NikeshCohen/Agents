import dotenv from "dotenv";

import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { TRANSLATION_PROMPTS } from "./prompts.js";

dotenv.config();

async function translateWithFeedback(text, targetLanguage) {
  let currentTranslation = "";
  let iterations = 0;
  const MAX_ITERATIONS = 3;

  // Initial translation
  const { text: translation } = await generateText({
    model: google("gemini-2.5-flash"), // use small model for first attempt
    system: TRANSLATION_PROMPTS.LITERARY_TRANSLATOR,
    prompt: `Translate this text to ${targetLanguage}, preserving tone and cultural nuances:
    ${text}`,
  });

  currentTranslation = translation;

  // Evaluation-optimization loop
  while (iterations < MAX_ITERATIONS) {
    // Evaluate current translation
    const { object: evaluation } = await generateObject({
      model: google("gemini-2.5-pro"), // use a larger model to evaluate
      schema: z.object({
        qualityScore: z.number().min(1).max(10),
        preservesTone: z.boolean(),
        preservesNuance: z.boolean(),
        culturallyAccurate: z.boolean(),
        specificIssues: z.array(z.string()),
        improvementSuggestions: z.array(z.string()),
      }),
      system: TRANSLATION_PROMPTS.TRANSLATION_EVALUATOR,
      prompt: `Evaluate this translation:

      Original: ${text}
      Translation: ${currentTranslation}

      Consider:
      1. Overall quality
      2. Preservation of tone
      3. Preservation of nuance
      4. Cultural accuracy`,
    });

    // Check if quality meets threshold
    if (
      evaluation.qualityScore >= 8 &&
      evaluation.preservesTone &&
      evaluation.preservesNuance &&
      evaluation.culturallyAccurate
    ) {
      break;
    }

    // Generate improved translation based on feedback
    const { text: improvedTranslation } = await generateText({
      model: google("gemini-2.5-pro"), // use a larger model
      system: TRANSLATION_PROMPTS.TRANSLATION_REFINER,
      prompt: `Improve this translation based on the following feedback:
      ${evaluation.specificIssues.join("\n")}
      ${evaluation.improvementSuggestions.join("\n")}

      Original: ${text}
      Current Translation: ${currentTranslation}`,
    });

    currentTranslation = improvedTranslation;
    iterations++;
  }

  return {
    finalTranslation: currentTranslation,
    iterationsRequired: iterations,
  };
}

(async () => {
  const { finalTranslation, iterationsRequired } = await translateWithFeedback(
    "The autumn leaves danced in the crisp morning air, their golden hues painting a masterpiece against the azure sky. As the wind whispered through the branches, each leaf told its own story of change and renewal.",
    "Japanese"
  );
  console.log("Final Translation:", finalTranslation);
  console.log("Iterations Required:", iterationsRequired);
})();
