import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, CLAUDE_MODEL } from "../lib/claude.js";
import { analysisResultSchema, type AnalysisResult } from "../schemas.js";

export class ClaudeAnalysisError extends Error {}

const SYSTEM_PROMPT = `You are a recruitment screening assistant. You are given a candidate's resume text and a job description. Assess how well the candidate matches the role.

Return your assessment as JSON matching the required schema:
- matchScore: an integer 0-100 rating overall fit
- strengths: specific ways the resume matches the job description (skills, experience, achievements)
- gaps: specific requirements from the job description the resume does not clearly demonstrate
- summary: a one-paragraph plain-language summary of the fit, written for a hiring manager

Base your assessment only on what is actually stated in the resume and job description. Be specific and reference concrete details rather than generic statements.`;

export async function analyzeResumeAgainstJob(
  resumeText: string,
  jobDescription: string,
): Promise<AnalysisResult> {
  let response;
  try {
    response = await anthropic.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `<resume>\n${resumeText}\n</resume>\n\n<job_description>\n${jobDescription}\n</job_description>`,
        },
      ],
      output_config: {
        format: zodOutputFormat(analysisResultSchema),
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("Claude API request failed:", error);
      throw new ClaudeAnalysisError(
        "The AI analysis service is temporarily unavailable. Please try again in a moment.",
      );
    }
    throw error;
  }

  if (!response.parsed_output) {
    throw new ClaudeAnalysisError("Claude did not return a valid analysis");
  }

  return response.parsed_output;
}
