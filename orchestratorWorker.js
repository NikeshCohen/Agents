import dotenv from "dotenv";

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import dotenv from "dotenv";

async function implementFeature(featureRequest) {
  // Orchestrator: Plan the implementation
  const { object: implementationPlan } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: z.object({
      files: z.array(
        z.object({
          purpose: z.string(),
          filePath: z.string(),
          changeType: z.enum(["create", "modify", "delete"]),
        })
      ),
      estimatedComplexity: z.enum(["low", "medium", "high"]),
    }),
    system:
      "You are a senior software architect planning feature implementations.",
    prompt: `Analyze this feature request and create an implementation plan:
    ${featureRequest}`,
  });

  // Workers: Execute the planned changes
  const fileChanges = await Promise.all(
    implementationPlan.files.map(async (file) => {
      // Each worker is specialized for the type of change
      const workerSystemPrompt = {
        create:
          "You are an expert at implementing new files following best practices and project patterns.",
        modify:
          "You are an expert at modifying existing code while maintaining consistency and avoiding regressions.",
        delete:
          "You are an expert at safely removing code while ensuring no breaking changes.",
      }[file.changeType];

      const { object: change } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: z.object({
          explanation: z.string(),
          code: z.string(),
        }),
        system: workerSystemPrompt,
        prompt: `Implement the changes for ${file.filePath} to support:
        ${file.purpose}

        Consider the overall feature context:
        ${featureRequest}`,
      });

      return {
        file,
        implementation: change,
      };
    })
  );

  return {
    plan: implementationPlan,
    changes: fileChanges,
  };
}

(async () => {
  const featureRequest = `
Feature: Add Dark Mode Support to EcoCharge Pro Mobile App

Requirements:
1. Add system-wide dark mode toggle in settings
2. Create dark color palette following Material Design 3.0 guidelines
3. Implement automatic theme switching based on system preferences
4. Persist theme preference in local storage
5. Update all existing components with dark mode styles
6. Add theme transition animations

Technical Constraints:
- Must maintain accessibility standards (WCAG 2.1)
- Theme switching must be performant (no flickering)
- Support for both iOS and Android platforms
- Backward compatible with existing styling system
`;

  const { plan, changes } = await implementFeature(featureRequest);
  console.log("Implementation Plan:", JSON.stringify(plan, null, 2));
  console.log("\nProposed Changes:");
  changes.forEach((change, index) => {
    console.log(
      `\n${index + 1}. ${change.file.filePath} (${change.file.changeType}):`
    );
    console.log(`   Purpose: ${change.file.purpose}`);
    console.log(`   Explanation: ${change.implementation.explanation}`);
    console.log(`   Code Changes:\n${change.implementation.code}`);
  });
})();
