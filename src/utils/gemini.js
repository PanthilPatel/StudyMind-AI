/**
 * Gemini API Utility — Secure Edition
 * 
 * Handles connections to Google's Gemini 1.5 Flash AI API.
 */

const DEV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const IS_PRODUCTION = import.meta.env.PROD;

// Set to Gemini 1.5 Flash as requested. Note: If your key doesn't support this
// specific version, change it to 'gemini-2.0-flash-lite' or 'gemini-2.5-flash-lite'.
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

/**
 * Call the AI via serverless function (production) or direct API (development)
 */
export async function generateWithGemini(tool, input) {
  if (IS_PRODUCTION) {
    return generateViaServerless(tool, input);
  }

  if (!DEV_API_KEY) {
    throw new Error('Missing API Key: Please add VITE_GEMINI_API_KEY to your .env file.');
  }

  return generateDirect(tool, input);
}

/**
 * PRODUCTION: Call via Vercel serverless function
 */
async function generateViaServerless(tool, input) {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, input }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Server responded with status ${response.status}`);
    }

    if (!data.text) {
      throw new Error('The AI returned an empty response.');
    }

    return data.text;
  } catch (error) {
    console.error("Serverless API Error:", error);
    throw new Error(error.message || 'Network error. Please check your connection.');
  }
}

/**
 * DEVELOPMENT ONLY: Call Gemini API directly
 */
async function generateDirect(tool, input) {
  // 1. Define prompts based on the selected tool
  const TOOL_PROMPTS = {
    'topic-explainer': (inp) => `You are an expert educator. Explain the following topic in a clear, simple, and structured way. Use analogies where helpful. Break it into sections with headings. Make it easy for a student to understand.\n\nTopic: ${inp}\n\nFormat your response with clear markdown headings (##), bullet points, and examples.`,
    'notes-generator': (inp) => `You are a study notes expert. Convert the following topic into well-structured, comprehensive study notes. Include key concepts, definitions, important points, and summary.\n\nTopic: ${inp}\n\nFormat the output as structured study notes with:\n- ## Main headings for sections\n- **Bold** for key terms\n- Bullet points for details\n- A summary section at the end`,
    'content-writer': (inp) => `You are a professional content writer. Generate high-quality content based on the following request. The content should be engaging, well-structured, and ready to use.\n\nRequest: ${inp}\n\nProvide polished, professional content with proper formatting using markdown.`,
    'mcq-generator': (inp) => `You are an expert quiz maker. Generate 10 multiple-choice questions (MCQs) on the following topic. Each question should have 4 options (A, B, C, D) with the correct answer marked.\n\nTopic: ${inp}\n\nFormat each question as:\n### Q1. [Question text]\n- A) [Option]\n- B) [Option]\n- C) [Option]\n- D) [Option]\n\n**✅ Correct Answer: [Letter]) [Answer]**\n\n---\n\nMake questions progressively harder. Include a mix of conceptual and application-based questions.`,
    'flashcard-generator': (inp) => `You are a study assistant. Extract 5-8 key concepts from the following text and create high-quality flashcards for study.
    Each flashcard must have a 'front' (question/concept) and 'back' (answer/explanation).
    
    TEXT:
    ${inp}
    
    RESPONSE FORMAT (STRICT JSON ARRAY):
    [
      { "front": "Question here", "back": "Answer here" },
      ...
    ]
    
    Return ONLY the JSON. No preamble, no markdown code blocks.`
  };

  const promptFn = TOOL_PROMPTS[tool];
  if (!promptFn) throw new Error(`Internal Error: Unknown tool ${tool}`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${DEV_API_KEY}`;

  console.log('[DEBUG] Starting direct fetch to Gemini API...', { model: GEMINI_MODEL });
  try {
    // 3. Make the fetch request with Retry Logic for 429 Rate Limits
    let response;
    const maxRetries = 3;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      console.log(`[DEBUG] Fetch attempt ${attempt + 1}...`);
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptFn(input) }] }],
          generationConfig: {
            temperature: 0.7, 
            topK: 40, 
            topP: 0.95, 
            maxOutputTokens: 4096,
          },
        }),
      });

      console.log('[DEBUG] Fetch resolved!', response.status, response.ok);

      if (response.status === 429 && attempt < maxRetries - 1) {
        const errorData = await response.clone().json().catch(() => ({}));
        const apiMessage = errorData?.error?.message || '';
        
        // Try to parse exact wait time from Gemini's "Please retry in X.XXs" message
        let waitMs = 5000 * Math.pow(2, attempt); // Default: 5s, 10s
        const match = apiMessage.match(/Please retry in ([\d.]+)s/);
        if (match && match[1]) {
          waitMs = parseFloat(match[1]) * 1000 + 1000; // Exact time + 1s safety buffer
        }
        
        console.warn(`[DEBUG] Rate limit hit (429). Retrying in ${Math.round(waitMs/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue; // Retry loop
      }

      break; // Break loop if not 429 or max retries reached
    }

    // 4. Handle HTTP errors
    if (!response.ok) {
      console.log('[DEBUG] Response not OK, parsing error...');
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini Direct API Error:", errorData);
      
      const apiMessage = errorData?.error?.message || `HTTP Status ${response.status}`;
      throw new Error(`Gemini API Error: ${apiMessage}`);
    }

    // 5. Parse JSON
    console.log('[DEBUG] Parsing successful JSON response...');
    const data = await response.json();
    console.log('[DEBUG] JSON parsed successfully.');

    // 6. Safely extract response text using optional chaining
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // 7. Handle empty responses completely
    if (!text || text.trim() === '') {
      throw new Error('No response generated by the AI model. Please try a different prompt.');
    }

    return text;

  } catch (error) {
    console.log('[DEBUG] Caught an error in catch block:', error);
    console.error("Fetch Execution Error:", error);
    throw new Error(error.message || "Failed to reach Gemini API.");
  }
}

/**
 * Tool metadata for UI rendering
 */
export const TOOLS = [
  { id: 'topic-explainer', name: 'Topic Explainer', description: 'Get clear, simple explanations of any topic', icon: '💡', placeholder: 'Enter a topic to explain (e.g., "Quantum Computing", "Machine Learning basics")', color: '#6366F1' },
  { id: 'notes-generator', name: 'Notes Generator', description: 'Convert any topic into structured study notes', icon: '📝', placeholder: 'Enter a topic to generate notes for (e.g., "Photosynthesis", "World War II causes")', color: '#10B981' },
  { id: 'content-writer', name: 'Content Writer', description: 'Generate blogs, captions, emails, and more', icon: '✍️', placeholder: 'Describe what content you need (e.g., "Write a blog post about AI in education")', color: '#F59E0B' },
  { id: 'mcq-generator', name: 'MCQ Quiz Maker', description: 'Generate quiz questions with answers instantly', icon: '🧠', placeholder: 'Enter a topic for quiz questions (e.g., "Data Structures", "Indian History")', color: '#EF4444' },
  { id: 'flashcard-generator', name: 'Flashcard Pro', description: 'Convert any text into interactive study cards', icon: '📇', placeholder: 'Enter text or paste notes to convert them into flashcards', color: '#A855F7' }
];
