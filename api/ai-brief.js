const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-26b-a4b-it:free";
// Free OpenRouter models come and go, so try several (checked against /api/v1/models, Oct 2026).
const OPENROUTER_FALLBACK_MODELS = [
  OPENROUTER_MODEL,
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
].filter((model, index, models) => model && models.indexOf(model) === index);

function buildBriefPrompt(market) {
  const prompt = {
    question: market.q,
    category: market.cat,
    yesProbability: market.yes,
    noProbability: 100 - Number(market.yes || 0),
    closes: market.closes,
    resolutionRule: market.rule,
    source: market.source,
  };

  return [
    "Create a short, neutral prediction-market brief for this PredictArc testnet market.",
    "Do not give financial advice. Do not tell the user what to buy.",
    "Return only valid JSON with keys: summary, yesCase, noCase, risks, watchlist, disclaimer.",
    "summary must be one sentence.",
    "yesCase, noCase, risks, and watchlist must each be arrays of exactly 3 short strings.",
    "disclaimer must be one short sentence saying this is informational and not financial advice.",
    "",
    JSON.stringify(prompt, null, 2),
  ].join("\n");
}

function parseBrief(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function requestOpenRouterBrief(market, model) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://predictarc.vercel.app",
      "X-Title": "PredictArc Testnet",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You write short, neutral prediction-market briefs for a testnet app. Return only valid JSON.",
        },
        {
          role: "user",
          content: buildBriefPrompt(market),
        },
      ],
      temperature: 0.35,
      max_tokens: 700,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.metadata?.raw || data.error?.message || "OpenRouter request failed");
    error.status = response.status;
    throw error;
  }

  const parsed = parseBrief(data.choices?.[0]?.message?.content || "");
  if (!parsed) {
    const error = new Error("OpenRouter returned an unreadable brief");
    error.status = 502;
    throw error;
  }
  return parsed;
}

async function createBrief(market) {
  if (!process.env.OPENROUTER_API_KEY) {
    const error = new Error("OPENROUTER_API_KEY missing");
    error.status = 501;
    throw error;
  }

  let lastError = null;
  for (const model of OPENROUTER_FALLBACK_MODELS) {
    try {
      return await requestOpenRouterBrief(market, model);
    } catch (error) {
      lastError = error;
      // A bad key won't work on any model; anything else (retired model, rate limit, bad output) tries the next.
      if (error.status === 401 || error.status === 403) break;
    }
  }
  throw lastError || new Error("OpenRouter request failed");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const market = req.body?.market;
    if (!market?.q) {
      res.status(400).json({ error: "Market details are required" });
      return;
    }
    const brief = await createBrief(market);
    res.status(200).json({ brief });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Unable to create AI brief" });
  }
};
