import { requireUser } from "../lib/requireUser";
import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/ask", requireUser, async (req, res) => {
  const log = req.log;
  const { question, context } = req.body as {
    question?: string;
    context?: {
      orgType: string;
      totalEvents: number;
      riskScore: number;
      riskLevel: string;
      executiveSummary: string;
      topEvents: Array<{ eventType: string; count: number; percentage: number }>;
      exploitProbabilities: Array<{ eventType: string; probability: number; severity: string; rationale: string }>;
      lossPotentials: Array<{ eventType: string; minLossEur: number; maxLossEur: number; avgLossEur: number; impactAreas: string[] }>;
    };
  };

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    res.status(400).json({ error: "A question is required." });
    return;
  }

  if (!context) {
    res.status(400).json({ error: "Analysis context is required." });
    return;
  }

  const systemPrompt = `You are an expert cybersecurity analyst assistant embedded in a SOC dashboard for a ${context.orgType} organization.
You have access to a completed AI risk analysis of uploaded security events and you answer analyst questions concisely, accurately, and in English.
Keep answers focused and actionable. Use bullet points for lists. Maximum 4–5 sentences unless more detail is explicitly requested.
Never make up data — only refer to the analysis context provided.`;

  const contextSummary = `
=== ANALYSIS CONTEXT ===
Organization sector: ${context.orgType}
Total events analyzed: ${context.totalEvents.toLocaleString()}
Overall risk score: ${context.riskScore}/100 (${context.riskLevel})
Executive summary: ${context.executiveSummary}

Top recurring event types (up to 10):
${context.topEvents.map((e, i) => `  ${i + 1}. ${e.eventType} — ${e.count} occurrences (${e.percentage.toFixed(1)}%)`).join("\n")}

Exploit probabilities (sorted by probability):
${context.exploitProbabilities.slice(0, 10).map((e, i) => `  ${i + 1}. ${e.eventType} — ${(e.probability * 100).toFixed(0)}% probability, severity: ${e.severity}`).join("\n")}

Financial loss potentials:
${context.lossPotentials.slice(0, 10).map((l, i) => `  ${i + 1}. ${l.eventType} — avg €${l.avgLossEur.toLocaleString()} (max €${l.maxLossEur.toLocaleString()}), impact: ${l.impactAreas.join(", ")}`).join("\n")}
========================
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${contextSummary}\n\nAnalyst question: ${question.trim()}` },
      ],
    });

    const answer = response.choices[0]?.message?.content ?? "Unable to generate an answer. Please try again.";
    res.json({ answer, question: question.trim() });
  } catch (err) {
    log.error({ err }, "OpenAI ask request failed");
    res.status(500).json({ error: "Failed to contact AI. Please try again." });
  }
});

export default router;
