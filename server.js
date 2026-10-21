// CircuitLens backend
// Keeps the Gemini API key on the server so it never reaches the browser.

require("dotenv").config();
const express = require("express");
const path = require("path");

const MODEL = process.env.GEMINI_MODEL || "gemma-4-31b-it"; // change here (or via env var) to swap models
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

const app = express();
app.set("trust proxy", 1); // needed so req.ip is correct behind Render's proxy
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------------------
// Simple in-memory rate limit (per IP) so a public link can't drain your quota
// ---------------------------------------------------------------------------
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 8; // per IP per minute
const hits = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const recent = (hits.get(req.ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    return res.status(429).json({
      error: { message: "Too many requests. Please wait a minute and try again." },
    });
  }
  recent.push(now);
  hits.set(req.ip, recent);
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    const recent = times.filter((t) => now - t < WINDOW_MS);
    if (recent.length) hits.set(ip, recent);
    else hits.delete(ip);
  }
}, WINDOW_MS).unref();

// ---------------------------------------------------------------------------
// Prompts (kept on the server so the endpoint can't be used as a general proxy)
// ---------------------------------------------------------------------------
const SCHEMA_TEMPLATE = `{
  "image_type": "component | schematic | breadboard | unclear",
  "circuit_type": "e.g. LED driver, voltage divider, 555 timer oscillator, etc., or 'unknown'",
  "summary": "2-3 sentence plain-language explanation of what the circuit does",
  "components": [
    { "name": "", "quantity": 1, "value_or_part_number": "", "role_in_circuit": "", "confidence": "high | medium | low" }
  ],
  "connections": ["short plain-language description of how key parts are connected"],
  "possible_problems": ["wiring mistakes, missing resistors, short circuits, polarity issues, etc."],
  "what_to_check": ["items the user should verify by hand with a multimeter or close inspection"],
  "overall_confidence": "high | medium | low"
}`;

const SYSTEM_INSTRUCTION = `You are CircuitLens, an expert electronics engineering assistant for students and hobbyists.
Rules:
1. Only list components and connections you can actually see in the image. Never invent part values, resistor colour-code readings, or wiring you cannot clearly see.
2. If something is hidden, blurry, or ambiguous, state it in "what_to_check" and lower the confidence.
3. For breadboards, recall the standard layout: the long rows on the sides are power rails, and the five holes in each column strip are connected. Use this to reason about connections, but say so when you cannot trace a wire.
4. For schematics, use standard electronic symbols and read visible labels and values.
5. Use simple, direct language suitable for a student.
6. You MUST reply with pure JSON matching this exact structure:
${SCHEMA_TEMPLATE}`;

const TYPE_PROMPTS = {
  component:
    "The user specified this is a SINGLE ELECTRONIC COMPONENT. Identify markings, pinouts, package type, and typical ratings.",
  schematic:
    "The user specified this is a SCHEMATIC / CIRCUIT DIAGRAM. Identify symbols, connections, labelled values, and functional purpose.",
  breadboard:
    "The user specified this is a BREADBOARD OR PROTOTYPE. Trace jumper wires, terminal rows, and bus connections meticulously.",
  auto: "The input type is AUTO-DETECT. First determine whether this is a component, schematic, breadboard, or unclear.",
};

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------
async function callGemini(payload) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY, // header instead of ?key= so it doesn't end up in URLs/logs
    },
    body: JSON.stringify(payload),
  });
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(API_KEY) });
});

app.post("/api/analyze", rateLimit, async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: { message: "Server is missing GEMINI_API_KEY. Add it to your .env file or hosting environment variables." },
      });
    }

    const { image, mimeType, inputType } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: { message: "No image received." } });
    }
    const mime = ALLOWED_MIME.includes(mimeType) ? mimeType : "image/jpeg";
    const typePrompt = TYPE_PROMPTS[inputType] || TYPE_PROMPTS.auto;

    const payload = {
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: mime, data: image } },
            {
              text: `${typePrompt}\n\nMANDATORY: Return pure JSON ONLY. Do not write introductory words or markdown code blocks.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    };

    let apiRes = await callGemini(payload);

    // Some models reject JSON mode. If so, retry once without it (the client parser handles plain text).
    if (apiRes.status === 400) {
      const errText = await apiRes.clone().text();
      if (/mime|json mode/i.test(errText)) {
        delete payload.generationConfig.responseMimeType;
        apiRes = await callGemini(payload);
      }
    }

    if (!apiRes.ok) {
      let message = `Gemini API error: HTTP ${apiRes.status}`;
      try {
        const errJson = await apiRes.json();
        if (errJson?.error?.message) message = errJson.error.message;
      } catch (_) {}
      console.error("Gemini error:", message);
      return res.status(apiRes.status).json({ error: { message } });
    }

    const data = await apiRes.json();
    res.json(data); // the browser extracts and parses the model output
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: { message: "Server error: " + err.message } });
  }
});

app.listen(PORT, () => {
  console.log(`CircuitLens running on http://localhost:${PORT}`);
  console.log(`Model: ${MODEL} | API key loaded: ${Boolean(API_KEY)}`);
});
