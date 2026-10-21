# CircuitLens

**Upload a photo of a circuit and find out what it is.** CircuitLens looks at a single component, a circuit diagram, or a breadboard prototype and tells you the circuit type, the components it can see, how they appear to be connected, and what to double-check before you power anything on.

Built for the Hacktoberfest Hack Day (Minna x GDGoC FUTMinna) with the open-weight **Gemma 4** model through the Gemini API.

> Entered in: **Best Use of Gemma 4** and **Best Open-Source AI Project**

---

## What it does

| Input | What you get |
| --- | --- |
| A single component (sensor, motor, IC, relay...) | What it is, its role, and what to check |
| A schematic or hand-drawn circuit diagram | Symbols read, circuit type (e.g. voltage divider, RC filter, 555 oscillator), component list |
| A breadboard or prototype photo | Components found, how they appear to be wired, visible mistakes |

Every result includes:

- **Circuit type** and a plain-language summary
- **Components table** with quantity, value or marking, role, and a confidence badge (high / medium / low)
- **Wiring and connections** as short descriptions
- **Visible problems and hazards** (for example a missing current-limiting resistor or reversed polarity)
- **Please verify by hand**: the things the photo could not confirm
- A **Copy results** button for a plain-text report

CircuitLens is told to list only what it can actually see, and to lower its confidence and say so when something is blurry, hidden, or ambiguous.

## The model

| | |
| --- | --- |
| **Model** | Gemma 4, `gemma-4-31b-it` (31B dense, instruction-tuned, multimodal) |
| **Made by** | Google DeepMind |
| **Accessed through** | The Gemini API (key from Google AI Studio) |
| **Model weights license** | Apache License 2.0 |

Gemma 4 is an open-weight model, so the same weights can also be downloaded and self-hosted. To use a different Gemma 4 size, change the `GEMINI_MODEL` environment variable (or the default in `server.js`).

### Licenses and terms

- **Gemma 4 model license (Apache 2.0):** https://www.apache.org/licenses/LICENSE-2.0
- **Gemma 4 documentation and downloads (Google):** https://ai.google.dev/gemma/docs/core
- **Gemini API terms** (these apply to calls made through Google's hosted API, separately from the model license): https://ai.google.dev/gemini-api/terms
- **This project's code:** MIT License, see [LICENSE](LICENSE)

Gemma and Gemini are trademarks of Google LLC. This project is not affiliated with or endorsed by Google.

## How it works

```
Browser (public/index.html)
   |  resizes the photo, sends it as base64
   v
Express server (server.js)  <-- holds GEMINI_API_KEY, builds the prompt
   |  calls the Gemini API with gemma-4-31b-it
   v
Gemini API  -->  JSON analysis  -->  rendered as result cards
```

- The **API key stays on the server** and is never sent to the browser.
- The server limits each IP to 8 requests per minute so a public link can't drain the quota.
- The browser flattens transparent PNG diagrams onto a white background and downsizes large photos before upload.
- The page parses the model's JSON tolerantly (it skips "thinking" parts, strips code fences, and falls back to an approximate view with a warning if the model doesn't return JSON).
- Images are processed in memory and are **not saved** by this app. They are sent to Google's Gemini API, whose terms govern how Google handles that data.

## Run it locally

You need Node.js 18 or newer (https://nodejs.org) and a free API key from https://aistudio.google.com.

```bash
git clone <your-repo-url>
cd circuitlens
cp .env.example .env        # then edit .env and paste your key
npm install
npm start
```

Open http://localhost:3000. To check the server and key, visit http://localhost:3000/api/health. It should report `"hasKey": true`.

`.env`:

```
GEMINI_API_KEY=your_key_here
# Optional: use a different Gemma 4 model
# GEMINI_MODEL=gemma-4-26b-a4b-it
```

## Deploy on Render (free)

1. Push this repository to GitHub. Make sure `.env` is **not** committed (`.gitignore` already excludes it).
2. On https://render.com choose **New > Web Service** and connect the repository.
3. Build command: `npm install`. Start command: `npm start`.
4. Under **Environment**, add `GEMINI_API_KEY` with your key.
5. Deploy. The free plan sleeps when idle, so the first visit can take about a minute.

## Project structure

```
circuitlens/
  public/index.html   Frontend: upload, preview, result cards
  server.js           Backend: API proxy, prompts, rate limit
  package.json        Dependencies (express, dotenv)
  .env.example        Template for your API key
  LICENSE             MIT license for this project's code
```

## Limitations

- AI can misread circuits. Resistor colour bands, tangled breadboard wiring, small part markings, and hidden connections are the hardest cases.
- On breadboards the model can usually identify parts but cannot reliably trace every wire. Treat the connection list as a best guess.
- This is a learning aid, not a safety tool. **Always verify with a multimeter and the datasheets before powering a circuit.**
- Free-tier API quotas are limited, so heavy use may hit rate limits.

## Ideas for next steps

- Export a parts list (BOM) as CSV
- Generate a simple SPICE netlist from schematics
- Suggest fixes for the problems it finds
- Support multiple photos of one board from different angles
- Run fully offline with a smaller Gemma 4 model (E2B or E4B)

## Contributing

Issues and pull requests are welcome.

## License

Code: MIT License (see [LICENSE](LICENSE)). The Gemma 4 model is licensed separately under the Apache License 2.0, linked above.
