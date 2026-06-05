const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);

loadEnvFile(path.join(ROOT, ".env"));

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-26b-a4b-it:free";
const OPENROUTER_FALLBACK_MODELS = [
  OPENROUTER_MODEL,
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
].filter((model, index, models) => model && models.indexOf(model) === index);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 32_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
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

async function createAiBrief(market) {
  if (process.env.GEMINI_API_KEY) return createGeminiBrief(market);
  if (process.env.OPENROUTER_API_KEY) return createOpenRouterBrief(market);
  if (process.env.OPENAI_API_KEY) return createOpenAiBrief(market);

  const error = new Error("AI provider key missing");
  error.status = 501;
  throw error;
}

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
    "Create a short, neutral prediction-market brief for this ArcOdds testnet market.",
    "Do not give financial advice. Do not tell the user what to buy.",
    "Return only valid JSON with keys: summary, yesCase, noCase, risks, watchlist, disclaimer.",
    "summary must be one sentence.",
    "yesCase, noCase, risks, and watchlist must each be arrays of exactly 3 short strings.",
    "disclaimer must be one short sentence saying this is informational and not financial advice.",
    "",
    JSON.stringify(prompt, null, 2),
  ].join("\n");
}

async function createOpenRouterBrief(market) {
  let lastError = null;
  for (const model of OPENROUTER_FALLBACK_MODELS) {
    try {
      return await requestOpenRouterBrief(market, model);
    } catch (error) {
      lastError = error;
      const message = String(error.message || "").toLowerCase();
      if (error.status !== 429 && !message.includes("rate-limited")) break;
    }
  }
  throw lastError || new Error("OpenRouter request failed");
}

async function requestOpenRouterBrief(market, model) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:4173",
      "X-Title": "ArcOdds Testnet",
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

  const text = data.choices?.[0]?.message?.content || "";
  const parsed = parseBrief(text);
  if (!parsed) {
    const error = new Error("OpenRouter returned an unreadable brief");
    error.status = 502;
    throw error;
  }
  return parsed;
}

async function createGeminiBrief(market) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildBriefPrompt(market) }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 700,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "Gemini request failed");
    error.status = response.status;
    throw error;
  }

  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
  const parsed = parseBrief(text);
  if (!parsed) {
    const error = new Error("Gemini returned an unreadable brief");
    error.status = 502;
    throw error;
  }
  return parsed;
}

async function createOpenAiBrief(market) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY missing");
    error.status = 501;
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: [
        "You write short, neutral prediction-market briefs for a testnet app.",
        "Do not give financial advice. Do not tell the user what to buy.",
        "Return only valid JSON with keys: summary, yesCase, noCase, risks, watchlist, disclaimer.",
        "summary must be one sentence. yesCase, noCase, risks, and watchlist must each be arrays of exactly 3 short strings.",
        "disclaimer must be one short sentence saying this is informational and not financial advice.",
      ].join(" "),
      input: buildBriefPrompt(market),
      max_output_tokens: 700,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "OpenAI request failed");
    error.status = response.status;
    throw error;
  }

  const text = extractResponseText(data);
  const parsed = parseBrief(text);
  if (!parsed) {
    const error = new Error("AI returned an unreadable brief");
    error.status = 502;
    throw error;
  }
  return parsed;
}

async function handleAiBrief(req, res) {
  try {
    const body = await readBody(req);
    const payload = JSON.parse(body || "{}");
    if (!payload.market || !payload.market.q) {
      sendJson(res, 400, { error: "Market details are required" });
      return;
    }
    const brief = await createAiBrief(payload.market);
    sendJson(res, 200, { brief });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Unable to create AI brief" });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const cleanPath = decodeURIComponent(url.pathname === "/" ? "/arcodds.html" : url.pathname);
  const filePath = path.normalize(path.join(ROOT, cleanPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".json": "application/json; charset=utf-8",
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/ai-brief") {
    handleAiBrief(req, res);
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`ArcOdds AI server running at http://localhost:${PORT}`);
});
