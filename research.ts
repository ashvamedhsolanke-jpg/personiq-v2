import OpenAI from 'openai';
import { z } from 'zod';
import { PersonProfile, Source } from './types';
import { searchCommons } from './wikimedia';

const schema = z.object({
  name: z.string(),
  profession: z.string(),
  introduction: z.string(),
  tags: z.array(z.string()).max(8),
  quickFacts: z.array(z.object({ label: z.string(), value: z.string(), sourceIds: z.array(z.number()).optional() })),
  overview: z.string(),
  education: z.array(z.string()),
  career: z.array(z.object({ year: z.string(), event: z.string(), sourceIds: z.array(z.number()).optional() })),
  achievements: z.array(z.object({ year: z.string(), title: z.string(), description: z.string(), sourceIds: z.array(z.number()).optional() })),
  majorWork: z.array(z.object({ title: z.string(), description: z.string(), sourceIds: z.array(z.number()).optional() })),
  recentDevelopments: z.array(z.object({ date: z.string(), title: z.string(), description: z.string(), sourceIds: z.array(z.number()).optional() })),
  publicViews: z.array(z.object({ statement: z.string(), context: z.string(), sourceIds: z.array(z.number()).optional() })),
  faq: z.array(z.object({ question: z.string(), answer: z.string(), sourceIds: z.array(z.number()).optional() }))
});

function cleanUrl(u: string) {
  try { return new URL(u).toString(); } catch { return ''; }
}

function emptyProfile(name: string, source: Source): PersonProfile {
  return {
    name,
    profession: 'Public figure',
    introduction: source.snippet || `Public information about ${name}.`,
    tags: [],
    quickFacts: [],
    overview: source.snippet || `No structured biography was available for ${name}.`,
    education: [],
    career: [],
    achievements: [],
    majorWork: [],
    recentDevelopments: [],
    publicViews: [],
    faq: [],
    sources: [source]
  };
}

async function wikipediaFallback(name: string): Promise<PersonProfile> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/\s+/g, '_'))}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PersonIQ/2.0' } });
  if (!res.ok) throw new Error('No research provider is configured. Add OPENAI_API_KEY and TAVILY_API_KEY to .env.local.');
  const data = await res.json();
  const source: Source = {
    title: data.title || name,
    url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/\s+/g, '_'))}`,
    domain: 'en.wikipedia.org',
    snippet: data.extract || ''
  };
  const profile = emptyProfile(data.title || name, source);
  if (data.description) profile.profession = data.description;
  try {
    const photos = await searchCommons(profile.name);
    profile.portrait = photos[0];
    profile.photos = photos.slice(0, 8);
  } catch { /* images are optional */ }
  return profile;
}

export async function researchPerson(name: string): Promise<PersonProfile> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;

  // Local/demo mode: the app remains usable before API keys are configured.
  if (!openaiKey || !tavilyKey || openaiKey === 'your_openai_api_key' || tavilyKey === 'your_tavily_api_key') {
    return wikipediaFallback(name);
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const searchRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: `${name} biography career recent news official`,
      search_depth: 'advanced',
      topic: 'general',
      max_results: 10,
      include_answer: false,
      include_raw_content: false
    })
  });

  if (!searchRes.ok) {
    if (searchRes.status === 429) throw new Error('Research service is rate-limited. Please try again shortly.');
    throw new Error('Research search failed.');
  }

  const sd = await searchRes.json();
  const sources: Source[] = (sd.results || [])
    .map((r: any) => ({
      title: r.title,
      url: cleanUrl(r.url),
      domain: r.url ? new URL(r.url).hostname : '',
      published: r.published_date,
      snippet: r.content
    }))
    .filter((s: Source) => s.url);

  if (!sources.length) throw new Error('No reliable public sources were found for that search.');

  const context = sources.map((s, i) => `SOURCE ${i}: ${s.title}\nURL: ${s.url}\nDATE: ${s.published || 'unknown'}\nCONTENT: ${s.snippet || ''}`).join('\n\n');

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5',
    input: [
      {
        role: 'system',
        content: 'You are PersonIQ, a careful public-person research editor. Use ONLY the supplied sources. Never invent facts. If a field is not supported, omit it or say "Not reliably documented in the sources reviewed." Do not expose sensitive personal data about private people. For public figures, summarize documented public information. Every sourceIds value must point to a source index in the supplied list. Recent developments must be genuinely recent based on source dates; if none are recent, return an empty array. Public views must distinguish the person’s own documented statements from reporting/analysis in the context field. Return JSON only matching the schema.'
      },
      { role: 'user', content: `Research target: ${name}\n\n${context}` }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'person_profile',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            profession: { type: 'string' },
            introduction: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            quickFacts: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'number' } } }, required: ['label', 'value'], additionalProperties: false } },
            overview: { type: 'string' },
            education: { type: 'array', items: { type: 'string' } },
            career: { type: 'array', items: { type: 'object', properties: { year: { type: 'string' }, event: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'number' } } }, required: ['year', 'event'], additionalProperties: false } },
            achievements: { type: 'array', items: { type: 'object', properties: { year: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'number' } } }, required: ['year', 'title', 'description'], additionalProperties: false } },
            majorWork: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'number' } } }, required: ['title', 'description'], additionalProperties: false } },
            recentDevelopments: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'number' } } }, required: ['date', 'title', 'description'], additionalProperties: false } },
            publicViews: { type: 'array', items: { type: 'object', properties: { statement: { type: 'string' }, context: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'number' } } }, required: ['statement', 'context'], additionalProperties: false } },
            faq: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'number' } } }, required: ['question', 'answer'], additionalProperties: false } }
          },
          required: ['name', 'profession', 'introduction', 'tags', 'quickFacts', 'overview', 'education', 'career', 'achievements', 'majorWork', 'recentDevelopments', 'publicViews', 'faq'],
          additionalProperties: false
        }
      }
    }
  });

  const parsed = schema.parse(JSON.parse(response.output_text));
  let photos: Awaited<ReturnType<typeof searchCommons>> = [];
  try { photos = await searchCommons(parsed.name); } catch { /* images are optional */ }
  return { ...parsed, portrait: photos[0], photos: photos.slice(0, 8), sources };
}
