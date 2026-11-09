import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Server-side Gemini Client
const apiKey = process.env.GEMINI_API_KEY || '';
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('[Gemini AI] Failed to initialize client:', err);
  }
}

/* ------------------------------------------------------------------ */
/* 1. AI Content Safety Screening Route                               */
/* ------------------------------------------------------------------ */
app.post('/api/ai/content-safety', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.json({ safe: true, flaggedCategories: [] });
  }

  // Quick heuristic check for obvious spam / toxicity
  const lower = text.toLowerCase();
  const toxicKeywords = ['hate', 'kill', 'scam', 'crypto free money', 'dm for money', 'free giveaway link', 'f***', 's***'];
  const matched = toxicKeywords.filter((k) => lower.includes(k));

  if (matched.length > 0) {
    return res.json({
      safe: false,
      flaggedCategories: ['Toxic language / Spam patterns'],
      warningMessage: 'This content contains words that may violate community safety guidelines.',
    });
  }

  if (!aiClient) {
    return res.json({ safe: true, flaggedCategories: [] });
  }

  try {
    const prompt = `Analyze the following user-submitted social media text for severe toxicity, hate speech, harassment, threats, or spam.
Respond with ONLY valid JSON with keys:
"safe": boolean,
"flaggedCategories": array of strings (empty if safe),
"warningMessage": string or null.

Text to inspect: "${text.replace(/"/g, '\\"')}"`;

    const timeoutPromise = new Promise<{ text: string }>((_, reject) =>
      setTimeout(() => reject(new Error('AI request timeout')), 3500)
    );

    const apiPromise = aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const response = (await Promise.race([apiPromise, timeoutPromise])) as any;
    const parsed = JSON.parse(response.text || '{"safe":true,"flaggedCategories":[]}');
    return res.json(parsed);
  } catch (error) {
    console.warn('[Gemini Safety] Fallback due to error:', error);
    return res.json({ safe: true, flaggedCategories: [] });
  }
});

/* ------------------------------------------------------------------ */
/* 2. Instant Translator Route                                        */
/* ------------------------------------------------------------------ */
app.post('/api/ai/translate', async (req, res) => {
  const { text, targetLang = 'English' } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (!aiClient) {
    // Intelligent simulation for offline/preview demo
    const translations: Record<string, string> = {
      'Midnight golden hour in Shibuya. When rain meets neon reflections, Tokyo turns into a live-action cyberpunk canvas 🌧️🏮 Shot on 35mm f/1.4':
        'Heure dorée de minuit à Shibuya. Quand la pluie rencontre les reflets néon, Tokyo se transforme en une toile cyberpunk en direct 🌧️🏮 Pris au 35mm f/1.4',
      'Analog oscillators warmth hit different today. Recording the final stem mix for the upcoming vinyl EP. Turn the headphones all the way up 🎧':
        'La chaleur des oscillateurs analogiques est unique aujourd’hui. Enregistrement du mixage final pour le prochain EP vinyle. Montez le son au casque 🎧',
    };

    const simulated = translations[text.trim()] || `[Translated to ${targetLang}]: ${text}`;
    return res.json({
      original: text,
      translated: simulated,
      targetLanguage: targetLang,
      detectedLanguage: 'Auto',
    });
  }

  try {
    const prompt = `Translate the following social media post or comment text into ${targetLang}.
Preserve tone, emojis, and hashtags naturally.
Respond with ONLY valid JSON with keys:
"translated": string,
"detectedLanguage": string.

Original text: "${text.replace(/"/g, '\\"')}"`;

    const timeoutPromise = new Promise<{ text: string }>((_, reject) =>
      setTimeout(() => reject(new Error('AI request timeout')), 3500)
    );

    const apiPromise = aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const response = (await Promise.race([apiPromise, timeoutPromise])) as any;
    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      original: text,
      translated: parsed.translated || text,
      detectedLanguage: parsed.detectedLanguage || 'Auto',
      targetLanguage: targetLang,
    });
  } catch (err) {
    console.warn('[Gemini Translate] Error translating:', err);
    return res.json({
      original: text,
      translated: `[Translated to ${targetLang}]: ${text}`,
      detectedLanguage: 'Auto',
      targetLanguage: targetLang,
    });
  }
});

/* ------------------------------------------------------------------ */
/* 3. AI Media & Thumbnail Creator Route                              */
/* ------------------------------------------------------------------ */
app.post('/api/ai/generate-media', async (req, res) => {
  const { prompt, style = 'Cyberpunk Neon', aspectRatio = '1:1' } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Pre-curated premium creator visuals categorized by artistic styles
  const stylePresets: Record<string, string[]> = {
    'Cyberpunk Neon': [
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80',
    ],
    '3D Abstract Glass': [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=1200&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
    ],
    'Minimalist Architecture': [
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
    ],
    'Music Studio & Lo-Fi': [
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
    ],
  };

  const pool = stylePresets[style] || stylePresets['3D Abstract Glass'];
  const chosenUrl = pool[Math.floor(Math.random() * pool.length)];

  let refinedCaption = prompt;
  if (aiClient) {
    try {
      const timeoutPromise = new Promise<{ text: string }>((_, reject) =>
        setTimeout(() => reject(new Error('AI request timeout')), 3500)
      );

      const apiPromise = aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Write an engaging, atmospheric creator social post caption (under 180 characters) inspired by this concept: "${prompt}", styled as ${style}. Include 2 relevant hashtags.`,
      });

      const expansion = (await Promise.race([apiPromise, timeoutPromise])) as any;
      refinedCaption = expansion.text?.trim() || prompt;
    } catch {
      // fallback
    }
  }

  return res.json({
    mediaUrl: chosenUrl,
    suggestedCaption: refinedCaption,
    style,
    aspectRatio,
  });
});

/* ------------------------------------------------------------------ */
/* Vite Integration & Static Serving                                  */
/* ------------------------------------------------------------------ */
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Snoo Creators running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
