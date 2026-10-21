# CircuitLens

AI-assisted circuit analysis. Upload a photo of a single component, a circuit diagram, or a breadboard prototype, and CircuitLens identifies the circuit type and the components in it, flags visible problems, and lists what you should verify by hand.

Built with the open-weight **Gemma 4** model (`gemma-4-31b-it`) through the **Gemini API**.

## How it works

- `public/index.html` - the web page (upload, preview, results cards). It resizes the image in the browser and sends it to the server.
- `server.js` - a small Express server. It holds the API key, builds the prompt, calls the Gemini API, and returns the result. The key never reaches the browser.

## Run locally

1. Install Node.js 18 or newer from https://nodejs.org
2. Get a free API key from Google AI Studio: https://aistudio.google.com
3. Copy `.env.example` to `.env` and put your key in it:
   ```
   GEMINI_API_KEY=your_key_here
   ```
4. In the project folder run:
   ```
   npm install
   npm start
   ```
5. Open http://localhost:3000

Visit http://localhost:3000/api/health to check the server is up and the key was loaded.

## Deploy on Render (free)

1. Push this project to GitHub (make sure `.env` is NOT included; `.gitignore` already excludes it).
2. On https://render.com choose New > Web Service and connect your repository.
3. Build command: `npm install`  |  Start command: `npm start`
4. Under Environment, add `GEMINI_API_KEY` with your key.
5. Deploy. The free plan sleeps when idle, so the first visit can take about a minute.

## Limitations

AI can misread circuits. Resistor colour bands, tangled breadboard wiring, and small markings are the hardest cases. CircuitLens is a best-effort assistant: it reports its confidence and lists what to verify, but always check with a multimeter before powering anything.

## Tech

Node.js, Express, plain HTML/CSS/JavaScript, Gemini API (Gemma 4).
