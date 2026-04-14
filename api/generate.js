/**
 * Vercel Serverless Function — AI Generate
 * 
 * Proxies requests to the Gemini API so the API key stays server-side.
 * The frontend calls /api/generate instead of hitting Gemini directly.
 * 
 * Security benefits:
 * - API key never exposed in browser/network tab
 * - Can add rate limiting, validation, logging
 * - Prevents key theft and abuse
 */

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Tool-specific prompts (server-side only — never exposed to client)
const TOOL_PROMPTS = {
  'topic-explainer': (input) => `You are an expert educator. Explain the following topic in a clear, simple, and structured way. Use analogies where helpful. Break it into sections with headings. Make it easy for a student to understand.

Topic: ${input}

Format your response with clear markdown headings (##), bullet points, and examples.`,

  'notes-generator': (input) => `You are a study notes expert. Convert the following topic into well-structured, comprehensive study notes. Include key concepts, definitions, important points, and summary.

Topic: ${input}

Format the output as structured study notes with:
- ## Main headings for sections
- **Bold** for key terms
- Bullet points for details
- A summary section at the end`,

  'content-writer': (input) => `You are a professional content writer. Generate high-quality content based on the following request. The content should be engaging, well-structured, and ready to use.

Request: ${input}

Provide polished, professional content with proper formatting using markdown.`,

  'mcq-generator': (input) => `You are an expert quiz maker. Generate 10 multiple-choice questions (MCQs) on the following topic. Each question should have 4 options (A, B, C, D) with the correct answer marked.

Topic: ${input}

Format each question as:
### Q1. [Question text]
- A) [Option]
- B) [Option]  
- C) [Option]
- D) [Option]

**✅ Correct Answer: [Letter]) [Answer]**

---

Make questions progressively harder. Include a mix of conceptual and application-based questions.`
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { tool, input } = req.body;

  // Validate inputs
  if (!tool || !input) {
    return res.status(400).json({ error: 'Missing required fields: tool and input' });
  }

  if (!TOOL_PROMPTS[tool]) {
    return res.status(400).json({ error: `Invalid tool: ${tool}` });
  }

  if (input.length > 5000) {
    return res.status(400).json({ error: 'Input too long. Maximum 5000 characters.' });
  }

  // Get API key from server environment (NEVER exposed to client)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured in environment variables');
    return res.status(500).json({ error: 'AI service not configured. Contact support.' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const prompt = TOOL_PROMPTS[tool](input);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      return res.status(response.status).json({
        error: errorData?.error?.message || 'AI generation failed. Please try again.',
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({ error: 'No content generated. Please try a different prompt.' });
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
}
