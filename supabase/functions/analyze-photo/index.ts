// DepositProof — AI photo analysis edge function.
//
// Proxies an uploaded image to a developer-configured Ollama instance
// running a vision-language model (default llava:7b). The function is
// HONEST about availability: it never fabricates results. If the backend
// URL is not configured or unreachable, it returns an explicit
// `ai_unavailable` status so the frontend can guide the user.
//
// Configuration is read from the `app_settings` table (keys:
// `ai_backend_url`, `ai_model`, `ai_enabled`). The developer sets these
// through the Settings page; nothing is hardcoded.
//
// CORS is mandatory on every response.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_MODEL = "llava:7b";

interface AnalyzeRequest {
  imageBase64?: string;
  imageUrl?: string;
  description?: string;
  model?: string;
}

interface AiResult {
  description: string;
  suggested_category: string | null;
  observations: string[];
  confidence: "low" | "medium" | "high" | "unknown";
  uncertainty: string[];
}

const CATEGORIES = [
  "wall-cracks-marks",
  "paint-peeling",
  "broken-fixtures",
  "water-damage-stains",
  "damaged-furniture",
  "electrical-plumbing",
  "scratches-floor-damage",
  "other",
];

function jsonResult(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function loadSettings(supabaseUrl: string, serviceKey: string) {
  const resp = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=key,value`, {
    headers: {
      apiKey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) return { backendUrl: "", model: DEFAULT_MODEL, enabled: true };
  const rows = (await resp.json()) as { key: string; value: string }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    backendUrl: (map.get("ai_backend_url") || "").trim(),
    model: (map.get("ai_model") || DEFAULT_MODEL).trim(),
    enabled: (map.get("ai_enabled") || "true").trim() !== "false",
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeResult(raw: Record<string, unknown>): AiResult {
  const description = typeof raw.description === "string" ? raw.description : "";
  let suggestedCategory: string | null = null;
  if (typeof raw.suggested_category === "string") {
    const lower = raw.suggested_category.toLowerCase();
    suggestedCategory = CATEGORIES.find((c) => lower.includes(c.replace(/-/g, " ").replace(/_/g, " "))) || null;
  }
  const observations = Array.isArray(raw.observations)
    ? raw.observations.filter((o): o is string => typeof o === "string").slice(0, 8)
    : [];
  const confidence = (["low", "medium", "high", "unknown"].includes(String(raw.confidence))
    ? String(raw.confidence)
    : "unknown") as AiResult["confidence"];
  const uncertainty = Array.isArray(raw.uncertainty)
    ? raw.uncertainty.filter((u): u is string => typeof u === "string").slice(0, 6)
    : [];
  return { description, suggested_category: suggestedCategory, observations, confidence, uncertainty };
}

function buildPrompt(description?: string): string {
  const userCtx = description ? `\nThe user described this photo as: "${description}".\n` : "";
  return `You are a property inspection assistant. Analyze this photo of a rental property.
${userCtx}
Return ONLY a JSON object with this exact shape:
{
  "description": "Short factual description of visible surfaces, fixtures and conditions",
  "suggested_category": one of "wall-cracks-marks", "paint-peeling", "broken-fixtures", "water-damage-stains", "damaged-furniture", "electrical-plumbing", "scratches-floor-damage", "other",
  "observations": ["2-4 short observations about visible features"],
  "confidence": "low" | "medium" | "high",
  "uncertainty": ["reasons confidence may be low, e.g. blurry, dark, angled"]
}
Rules:
- Do NOT determine the cause or age of any damage.
- Do NOT claim who caused damage or legal responsibility.
- Do NOT certify image authenticity.
- If the image is blurry, dark, or ambiguous, set confidence "low" and explain in uncertainty.
- Keep description factual and concise.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResult({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResult({ error: "Server misconfigured", status: "ai_unavailable" }, 500);
  }

  try {
    const body = (await req.json()) as AnalyzeRequest;
    if (!body.imageBase64 && !body.imageUrl) {
      return jsonResult({ error: "imageBase64 or imageUrl is required" }, 400);
    }

    const settings = await loadSettings(supabaseUrl, serviceKey);
    if (!settings.enabled) {
      return jsonResult({
        status: "ai_disabled",
        message: "AI analysis is disabled in Settings.",
      });
    }
    if (!settings.backendUrl) {
      return jsonResult({
        status: "ai_unavailable",
        message: "No AI backend URL configured. Add your Ollama URL in Settings to enable AI photo analysis.",
      });
    }

    const model = body.model || settings.model;
    let imageData: string;

    if (body.imageBase64) {
      imageData = body.imageBase64.startsWith("data:")
        ? body.imageBase64
        : `data:image/jpeg;base64,${body.imageBase64.replace(/^data:.*?;base64,/, "")}`;
    } else {
      const imgResp = await fetch(body.imageUrl!);
      if (!imgResp.ok) {
        return jsonResult({ status: "ai_unavailable", message: "Could not load image for analysis." }, 502);
      }
      const buf = await imgResp.arrayBuffer();
      imageData = `data:image/jpeg;base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}`;
    }

    const ollamaUrl = settings.backendUrl.replace(/\/$/, "") + "/api/generate";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let ollamaResp: Response;
    try {
      ollamaResp = await fetch(ollamaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt: buildPrompt(body.description),
          images: [imageData.split(",")[1]],
          stream: false,
          format: "json",
        }),
      });
    } catch (err) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : "network error";
      return jsonResult({
        status: "ai_unavailable",
        message: `Could not reach the AI backend at ${settings.backendUrl}. ${msg}`,
        backend_url: settings.backendUrl,
      }, 504);
    }
    clearTimeout(timeout);

    if (!ollamaResp.ok) {
      const text = await ollamaResp.text().catch(() => "");
      return jsonResult({
        status: "ai_error",
        message: `AI backend returned ${ollamaResp.status}. ${text.slice(0, 200)}`,
        backend_url: settings.backendUrl,
      }, 502);
    }

    const ollamaData = (await ollamaResp.json()) as { response?: string; error?: string };
    if (ollamaData.error) {
      return jsonResult({ status: "ai_error", message: ollamaData.error, backend_url: settings.backendUrl }, 502);
    }

    const parsed = extractJson(ollamaData.response || "");
    if (!parsed) {
      return jsonResult({
        status: "ai_error",
        message: "The AI response could not be parsed as structured JSON.",
        raw: (ollamaData.response || "").slice(0, 400),
      }, 502);
    }

    return jsonResult({
      status: "ok",
      model,
      result: normalizeResult(parsed),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return jsonResult({ status: "ai_error", message: msg }, 500);
  }
});
