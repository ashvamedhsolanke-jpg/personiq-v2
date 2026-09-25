# PersonIQ V2

A real Next.js app for public-person research. It is not a hardcoded demo: searches are sent to a server-side route, fresh web sources are gathered, OpenAI structures only those sources into a strict schema, and Wikimedia Commons supplies image results plus source/license metadata.

## Required services

1. **OpenAI API** — used server-side for structured synthesis. Create an API key in your OpenAI account and set `OPENAI_API_KEY`.
2. **Tavily Search API** — used server-side for current web research. Create a key at Tavily and set `TAVILY_API_KEY`.
3. **Wikimedia Commons** — no API key required for the public MediaWiki API used by this app. Image source pages and available license metadata are displayed.

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
```

Put real keys in `.env.local`:

```env
OPENAI_API_KEY=...
TAVILY_API_KEY=...
```

Then:

```bash
npm run dev
```

Open http://localhost:3000.

## Production

```bash
npm run build
npm start
```

## Vercel deployment

1. Push this folder to GitHub.
2. Import the repository into Vercel.
3. Add `OPENAI_API_KEY` and `TAVILY_API_KEY` under Project Settings → Environment Variables.
4. Deploy.

The secrets are only read by `/api/research` on the server; they are never bundled into client JavaScript.

## Android-only workflow

The easiest phone-first path is GitHub + Vercel:

1. Install GitHub Mobile and create a repository.
2. Upload the project files (or create the files in GitHub's web editor).
3. Import the repository into Vercel from your phone browser.
4. Add the two environment variables in Vercel.
5. Deploy.

For local development on Android, tools such as Termux can run Node.js, but the cloud workflow is much simpler for a beginner.

## Architecture

`Search box → /api/research → Tavily → OpenAI structured JSON → Wikimedia Commons → PersonPage`

The AI receives the returned source snippets and source URLs and is instructed to avoid unsupported facts. Source IDs are stored alongside profile sections so the UI can link claims back to the gathered sources.

## Limitations / honest behavior

- A search can fail because a provider is unavailable, rate-limited, or returns no useful sources.
- Wikimedia Commons may have no suitable image for a person; the profile still works without a portrait.
- The model cannot make an unsupported fact reliable just because it sounds plausible; unsupported fields should be omitted.
- This app does not attempt private-person OSINT or sensitive-data discovery.
- The current search provider is Tavily. If you prefer another search API later, replace the fetch in `src/lib/research.ts` while preserving the `Source` shape.

## Future Android app

The existing responsive web app can later become an Android app with Capacitor (simple web-to-native packaging) or a separate React Native client that calls the same `/api/research` backend. Keeping research and API keys server-side means the backend can be reused.
