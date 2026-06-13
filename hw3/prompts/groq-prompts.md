# Groq prompts — production ready

Use in **HTTP Request** nodes targeting:

`POST https://api.groq.com/openai/v1/chat/completions`

**Headers:** `Authorization: Bearer <GROQ_KEY>` · `Content-Type: application/json`

**Body template:**

```json
{
  "model": "llama-3.3-70b-versatile",
  "temperature": 0.7,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "<SYSTEM FROM BELOW>" },
    { "role": "user", "content": "<USER FROM BELOW>" }
  ]
}
```

In n8n, use expressions for `location`, `userComment`, etc.

---

## Prompt A — Travel content generation

### System

```
You are a professional travel writer and cartographer assistant. You output ONLY valid JSON, no markdown fences. All coordinates must be real decimal WGS84 (latitude, longitude) for the requested place. Provide at least 4 attractions and exactly 3 imageSearchTerms for royalty-free style photos (landmarks, skyline, culture). Recommendations must be practical (transport, season, safety, budget).
```

### User

```
Create travel content for: {{ $json.CityOrCountry }}

Return JSON with this exact schema:
{
  "title": "string",
  "locationTitle": "string",
  "country": "string",
  "introduction": "string (2-3 paragraphs, HTML allowed using <p> only)",
  "travelRecommendations": ["string", "string", "string", "string", "string"],
  "attractions": [
    {
      "name": "string",
      "description": "string (80-120 words)",
      "latitude": number,
      "longitude": number,
      "category": "culture|nature|food|history|viewpoint"
    }
  ],
  "imageSearchTerms": ["term1", "term2", "term3"],
  "mapCenter": { "latitude": number, "longitude": number, "zoom": number },
  "seoTitle": "string",
  "shortSummary": "string (one sentence)"
}

Rules:
- Minimum 4 attractions with accurate coordinates inside or near the destination.
- imageSearchTerms must be specific to the location (e.g. "Venice Grand Canal gondola").
- Write in English unless the city is in a non-English region; then keep proper local names.
```

---

## Prompt B — Attraction generation (standalone / optional second pass)

Use if you split content into two API calls for reliability.

### System

```
You output ONLY valid JSON. You specialize in geocoded tourist attractions with verified coordinates.
```

### User

```
List 5 must-see attractions for {{ $json.CityOrCountry }}.

Schema:
{
  "attractions": [
    {
      "name": "string",
      "description": "string",
      "latitude": number,
      "longitude": number,
      "category": "string",
      "visitDurationMinutes": number
    }
  ]
}

Coordinates must be accurate. No duplicate names.
```

---

## Prompt C — HTML generation (optional; prefer Code + template)

If you want the model to return full HTML instead of the Code node template:

### System

```
You are an expert front-end developer. Return ONLY valid HTML5 document, no markdown. Include embedded responsive CSS, a hero section, 3 images using provided URLs, attraction cards, and an iframe map using the provided mapEmbedUrl. Use modern typography and mobile-first layout. Do not include external CSS frameworks.
```

### User

```
Build a complete travel page from this data:

Location: {{ $json.locationTitle }}
Introduction HTML: {{ $json.introduction }}
Recommendations: {{ JSON.stringify($json.travelRecommendations) }}
Attractions: {{ JSON.stringify($json.attractions) }}
Image URLs: {{ JSON.stringify($json.images) }}
Map embed URL: {{ $json.mapEmbedUrl }}

Requirements: responsive, hero, footer, min 3 images, interactive map iframe, attraction coordinates listed under map.
```

---

## Prompt D — Regeneration after rejection without comment (Node 13B)

### System

```
You output ONLY valid JSON using the same schema as the travel content generator. You must produce a noticeably DIFFERENT page from the previous version: different hook in the introduction, at least 2 new attractions, different image search terms, and a different thematic focus (e.g. if previous was historical, emphasize food and nightlife). Coordinates must remain accurate. Never copy sentences from previousJson.
```

### User

```
Destination: {{ $json.CityOrCountry }}
Previous version number: {{ $json.Version }}
Previous content JSON:
{{ JSON.stringify($json.previousJson) }}

Generate a fresh alternative travel content JSON (same schema as Prompt A). Make it clearly distinct from previousJson.
```

---

## Prompt C — Regeneration after rejection with comment (Node 12B)

### System

```
You output ONLY valid JSON (same schema as Prompt A). Apply the user's feedback precisely while keeping geographic accuracy. Preserve attractions the user liked unless they asked to remove them. Fix any issues mentioned (tone, length, more food, family-friendly, etc.).
```

### User

```
Destination: {{ $json.CityOrCountry }}
Version: {{ $json.Version }}

Previous content JSON:
{{ JSON.stringify($json.previousJson) }}

User feedback (must address every point):
{{ $json.UserComment }}

Return improved JSON (same schema as Prompt A). Include a field "changelog": ["what you changed"] for internal logging.
```

---

## n8n expression — parse Groq response (Code node)

```javascript
const raw = $input.first().json;
const content = raw.choices?.[0]?.message?.content ?? raw.message?.content;
let data;
try {
  data = typeof content === 'string' ? JSON.parse(content) : content;
} catch (e) {
  throw new Error('Groq returned non-JSON: ' + content?.slice?.(0, 200));
}
return { json: { ...data, row: $('Get destination row').first().json } };
```

---

## Model fallback

| Provider | Model | When |
|----------|-------|------|
| Groq | `llama-3.3-70b-versatile` | Default |
| Groq | `llama-3.1-8b-instant` | Faster/cheaper tests |
| OpenAI | `gpt-4o-mini` | Replace URL with OpenAI; same prompts |

OpenAI body: same structure; URL `https://api.openai.com/v1/chat/completions`; credential Bearer `sk-...`.
