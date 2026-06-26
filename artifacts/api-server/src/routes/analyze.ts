import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

interface RawEvent {
  date: string | null;
  eventType: string;
  category: string | null;
  severity: string | null;
  source: string | null;
  description: string | null;
  rawData: Record<string, string>;
}

const DATE_KEYS = ["date", "data", "datetime", "timestamp", "time", "hora", "dt", "fecha", "datum", "date_time", "event_date", "occurred", "occurred_at", "created_at", "created", "when"];
const YEAR_KEYS = ["year", "ano", "año", "année", "jahr", "yr", "year_event", "event_year", "ano_evento"];
const TYPE_KEYS = ["event_type", "eventtype", "type", "tipo", "event", "evento", "name", "nome", "alert_type", "alerttype", "incident_type", "category_type", "threat"];
const CATEGORY_KEYS = ["category", "categoria", "class", "classe", "group", "grupo", "family", "familia"];
const SEVERITY_KEYS = ["severity", "severidade", "priority", "prioridade", "criticality", "criticidade", "risk", "risco", "level", "nivel", "impact"];
const SOURCE_KEYS = ["source", "origem", "src", "ip", "host", "hostname", "device", "sensor", "origin", "from", "agent"];
const DESC_KEYS = ["description", "descricao", "descrição", "detail", "detalhe", "message", "mensagem", "info", "summary", "details", "notes", "text"];

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[\s_\-\.]/g, "_");
}

function findColumn(keys: Record<string, unknown>, candidates: string[]): string | null {
  const normalized = Object.keys(keys).reduce<Record<string, string>>((acc, k) => {
    acc[normalizeKey(k)] = k;
    return acc;
  }, {});
  for (const c of candidates) {
    if (normalized[c]) return normalized[c];
  }
  for (const c of candidates) {
    for (const n of Object.keys(normalized)) {
      if (n.includes(c) || c.includes(n)) return normalized[n];
    }
  }
  return null;
}

function parseExcelDate(value: unknown): string | null {
  if (!value || value === "") return null;

  // Handle actual JS Date objects (produced by XLSX with cellDates: true)
  if (value instanceof Date) {
    if (!isNaN(value.getTime()) && value.getFullYear() > 1990 && value.getFullYear() < 2050) {
      return value.toISOString().split("T")[0];
    }
    return null;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Try Excel serial date (number) — must be checked before string parsing
  const num = Number(str);
  if (!isNaN(num) && num > 20000 && num < 100000 && !str.includes("/") && !str.includes("-")) {
    try {
      const excelDate = XLSX.SSF.parse_date_code(num);
      if (excelDate) {
        const dd = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
        return dd.toISOString().split("T")[0];
      }
    } catch {
      // ignore
    }
  }

  // Try European format FIRST: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
  // This must come before new Date() to avoid MM/DD mis-interpretation
  const euMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (euMatch) {
    const day = parseInt(euMatch[1], 10);
    const month = parseInt(euMatch[2], 10);
    let year = parseInt(euMatch[3], 10);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year > 1990) {
      const dd = new Date(year, month - 1, day);
      if (!isNaN(dd.getTime())) return dd.toISOString().split("T")[0];
    }
  }

  // Try ISO format: yyyy-mm-dd (unambiguous)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(str);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2050) {
      return d.toISOString().split("T")[0];
    }
  }

  // Last resort: direct Date parse (handles RFC strings from xlsx cellDates)
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2050) {
    return d.toISOString().split("T")[0];
  }

  return null;
}

function parseYearValue(value: unknown): string | null {
  if (!value || value === "") return null;
  const str = String(value).trim();
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1990 && num <= 2035 && String(num) === str) {
    return `${num}-01-01`;
  }
  return null;
}

function parseExcelRows(buffer: Buffer): { rows: RawEvent[]; textLines: string[] } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rows: RawEvent[] = [];
  const textLines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    for (const row of jsonRows) {
      const rawData: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        rawData[k] = String(v).trim();
      }

      const dateCol = findColumn(row, DATE_KEYS);
      const yearCol = findColumn(row, YEAR_KEYS);
      const typeCol = findColumn(row, TYPE_KEYS);
      const catCol = findColumn(row, CATEGORY_KEYS);
      const sevCol = findColumn(row, SEVERITY_KEYS);
      const srcCol = findColumn(row, SOURCE_KEYS);
      const descCol = findColumn(row, DESC_KEYS);

      const dateVal = dateCol
        ? parseExcelDate(row[dateCol])
        : yearCol
        ? parseYearValue(row[yearCol])
        : null;
      const typeVal = typeCol ? String(row[typeCol]).trim() : "";
      const catVal = catCol ? String(row[catCol]).trim() : null;
      const sevVal = sevCol ? String(row[sevCol]).trim() : null;
      const srcVal = srcCol ? String(row[srcCol]).trim() : null;
      const descVal = descCol ? String(row[descCol]).trim() : null;

      // Fallback: use first non-date, non-empty column as event type
      const eventType = typeVal || catVal || descVal?.slice(0, 80) || Object.values(rawData).find(v => v.length > 0 && v.length < 100) || "Unknown";

      rows.push({
        date: dateVal,
        eventType,
        category: catVal,
        severity: sevVal,
        source: srcVal,
        description: descVal,
        rawData,
      });

      const parts = Object.values(rawData).filter(v => v.length > 0);
      if (parts.length > 0) textLines.push(parts.join(" | "));
    }
  }

  return { rows, textLines };
}

router.post("/analyze", upload.single("file"), async (req, res) => {
  const log = req.log;

  const orgType = req.body?.orgType as string | undefined;
  if (!orgType) {
    res.status(400).json({ error: "The 'orgType' field is required." });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "An Excel file is required." });
    return;
  }

  let rawEvents: RawEvent[] = [];
  let textLines: string[] = [];
  try {
    const parsed = parseExcelRows(req.file.buffer);
    rawEvents = parsed.rows;
    textLines = parsed.textLines;
  } catch (err) {
    log.error({ err }, "Failed to parse Excel file");
    res.status(400).json({ error: "Could not process the Excel file. Please check the format." });
    return;
  }

  if (rawEvents.length === 0) {
    res.status(400).json({ error: "The file contains no event data." });
    return;
  }

  const totalRows = rawEvents.length;
  const eventsPreview = textLines.slice(0, 200).join("\n");

  // Date range info for context
  const datesFound = rawEvents.map(e => e.date).filter(Boolean) as string[];
  const dateContext = datesFound.length > 0
    ? `Date range: ${datesFound.sort()[0]} to ${datesFound.sort().reverse()[0]}, with ${datesFound.length} events with an identified date.`
    : "No dates were detected in the events.";

  const systemPrompt = `You are an expert cybersecurity analyst with deep knowledge of risk analysis, ISO 27001, NIST Cybersecurity Framework, CIS Controls, and European regulation (GDPR, NIS2).
You analyze cybersecurity events from ${orgType} sector organizations and provide detailed English risk analyses.
You ALWAYS respond with valid JSON and no extra text outside the JSON.`;

  const userPrompt = `Analyze the following ${totalRows} cybersecurity events from a ${orgType} organization:
${dateContext}

${eventsPreview}

${totalRows > 200 ? `(Showing 200 of ${totalRows} events)` : ""}

Return ONLY this JSON (no markdown, no extra text):
{
  "topEvents": [
    { "eventType": "event type name", "count": occurrence_count, "percentage": percentage_0_to_100 }
  ],
  "exploitProbabilities": [
    { "eventType": "name", "probability": value_0_to_1, "severity": "Low|Medium|High|Critical", "rationale": "brief English explanation" }
  ],
  "controls": [
    { "eventType": "name", "measures": ["measure 1", "measure 2", "measure 3"], "frameworks": ["ISO 27001", "NIST"] }
  ],
  "lossPotentials": [
    { "eventType": "name", "minLossEur": min_value, "maxLossEur": max_value, "avgLossEur": avg_value, "impactAreas": ["area 1", "area 2"] }
  ],
  "eventTrends": [
    {
      "eventType": "name",
      "trend": "rising|stable|falling",
      "probability15d": probability_0_to_1_of_occurring_in_next_15_days,
      "probability30d": probability_0_to_1_of_occurring_in_next_30_days,
      "avgIntervalDays": estimated_average_days_between_occurrences,
      "lastOccurrence": "YYYY-MM-DD or null if no dates available",
      "forecastDate": "YYYY-MM-DD estimated next occurrence or null",
      "confidenceLevel": "Low|Medium|High",
      "reasoning": "1-2 sentence explanation of the forecast"
    }
  ],
  "executiveSummary": "3-4 sentence English executive summary",
  "riskScore": value_0_to_100,
  "riskLevel": "Low|Medium|High|Critical"
}

Rules:
- Identify the 5-10 most recurring event types
- For each type, calculate exploit probability based on frequency and the ${orgType} sector
- Loss values must reflect the ${orgType} sector context in euros
- Measures must be specific and actionable for the ${orgType} sector
- riskScore must be a number between 0 and 100
- eventTrends: provide one entry for each event type identified in topEvents
  - Use event dates and counts to infer frequency; if no dates, estimate from sector norms and event count
  - probability15d and probability30d: estimate probability (0-1) this event type occurs at least once in that window
  - trend: "rising" if frequency is increasing over time, "falling" if decreasing, "stable" if consistent
  - avgIntervalDays: estimated average days between occurrences of this event type
  - forecastDate: today is ${new Date().toISOString().split("T")[0]}; add avgIntervalDays to lastOccurrence (or today) to estimate next occurrence
  - confidenceLevel: "High" if dates are available and sample is large, "Medium" if partial dates, "Low" if no dates or small sample`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    let analysis: Record<string, unknown>;

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (parseErr) {
      log.error({ parseErr, raw }, "Failed to parse AI response as JSON");
      res.status(500).json({ error: "Failed to process AI response. Please try again." });
      return;
    }

    const result = {
      orgType,
      totalEvents: totalRows,
      analyzedAt: new Date().toISOString(),
      topEvents: analysis.topEvents ?? [],
      exploitProbabilities: analysis.exploitProbabilities ?? [],
      controls: analysis.controls ?? [],
      lossPotentials: analysis.lossPotentials ?? [],
      executiveSummary: analysis.executiveSummary ?? "",
      riskScore: analysis.riskScore ?? 0,
      riskLevel: analysis.riskLevel ?? "Medium",
      rawEvents,
      eventTrends: analysis.eventTrends ?? [],
    };

    res.json(result);
  } catch (err) {
    log.error({ err }, "OpenAI request failed");
    res.status(500).json({ error: "Failed to contact AI. Please try again." });
  }
});

export default router;
