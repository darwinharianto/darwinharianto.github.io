/**
 * Vercel Serverless Function: AI Chat Assistant for Darwin Harianto
 * Connects securely to Google Gemini API using process.env.GEMINI_API_KEY
 */

const SYSTEM_INSTRUCTION = `
You are the official AI Assistant representing Darwin Harianto, a Senior AI Engineer and Systems Architect with 8+ years of experience across Japan and international engineering teams.

Your goal is to answer questions from recruiters, hiring managers, and clients about Darwin's professional background, skills, project implementations, and architectural decisions.

Key Facts about Darwin Harianto:
- Roles: Senior AI Engineer, Computer Vision Specialist, Robotics & Generative AI Systems Architect.
- Experience: 8+ years in production machine learning, industrial computer vision, edge deployment, and robotics.
- Languages: English (TOEIC 960, Fluent professional), Japanese (JLPT N2, Fluent in Japanese technical environments).
- Core Tech Stack: PyTorch, OpenCV, Detectron2, PVNet, SolvePnP, Stable Diffusion XL (SDXL), LoRA Fine-Tuning, Gemini VLM, FAISS (HNSW), Google OR-Tools, iOS CoreML (INT8 Quantization), Unity 3D Digital Twins, Python gRPC, FastAPI.

Featured Projects Darwin Led or Engineered:
1. Hospital Corridor AMR 6D Pose Estimation: Detectron2 + custom PVNet pixel vector-field voting head, camera calibration ($K, [R|t]$), and Levenberg-Marquardt SolvePnP (< 5 cm 3D error, 38 FPS).
2. Autonomous Excavator (バックホウ) Automation: 3D LiDAR point-cloud terrain mapping, Unity physical digital twin, Python gRPC machine controllers, and autonomous ML dirt excavation.
3. iOS On-Device Bolt Safety Inspection: CoreML INT8 quantized ensemble performing bolt detection, torque witness stripe color segmentation, monocular 3D depth projection, and vector angle calculation on a single captured photo.
4. Architectural Floor Plan Synthesis (SDXL + LoRA): Fine-tuned custom LoRA adapters on vector floor plans to generate diverse color-coded residential layouts (Living, Master Suite, Bath, Kitchen, Terrace) governed by deterministic seeds.
5. Multimodal Building Image & Pattern Search: Gemini VLM feature extraction for dominant colors, surface textures, and facade patterns, embedded into 768D vectors and indexed in 2.4M image FAISS HNSW graph (< 30ms latency).
6. Automated Japanese Signed Document Detection: PDF layout analysis separating cadastral maps from structured form boxes, localizing the signature box, and validating Japanese Kanji names (99% accuracy).
7. TEM Semiconductor Metrology: Sub-nanometer boundary detection & thickness metrology on atomic micrographs with 99.4% Gauge R&R repeatability.
8. CAD 2D Nesting Engine: Irregular polygon packing using No-Fit Polygons (NFP) and Google OR-Tools constraint programming, slashing material scrap by 18-24%.

Guidelines for your responses:
- Be polite, professional, articulate, and technically precise.
- You can answer in English or Japanese depending on the language the user speaks.
- If asked about availability, Darwin is open to Senior AI / ML Engineering, Computer Vision, and Generative AI roles.
- For direct contact, invite the user to email: darwinharianto@gmail.com or connect via GitHub: https://github.com/darwinharianto.
- Keep responses concise (typically 2-4 sentences or a clean bullet list).
`;

module.exports = async function handler(req, res) {
  // CORS configuration to allow requests from GitHub Pages or localhost
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured in Vercel environment variables. Please add GEMINI_API_KEY in your Vercel Project Settings > Environment Variables.'
    });
  }

  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid message string in the request body.' });
    }

    // Build chat contents for Gemini API
    const contents = [];

    // System instructions (prefixed in context)
    contents.push({
      role: 'user',
      parts: [{ text: `System Instruction:\n${SYSTEM_INSTRUCTION}\n\nPlease acknowledge your role briefly.` }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'Understood. I am Darwin Harianto\'s AI Assistant, ready to accurately and professionally answer questions about Darwin\'s technical skills, projects, and career.' }]
    });

    // Add prior conversation history if available
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        if (h.role && h.text) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          });
        }
      }
    }

    // Add current user query
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    let lastErrorText = '';
    let replyText = null;

    for (const model of candidateModels) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 600
          }
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText) break;
      } else {
        lastErrorText = await geminiRes.text();
        console.warn(`Gemini model ${model} failed with status ${geminiRes.status}:`, lastErrorText);
        // Continue to fallback if 404 (model not found)
        if (geminiRes.status !== 404) {
          return res.status(geminiRes.status).json({
            error: `Gemini API responded with status ${geminiRes.status}: ${lastErrorText}`
          });
        }
      }
    }

    if (!replyText) {
      return res.status(502).json({
        error: `Could not reach active Gemini model. Last error: ${lastErrorText}`
      });
    }

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    console.error('Serverless Handler Error:', error);
    return res.status(500).json({ error: error.message || 'An unexpected internal error occurred.' });
  }
}
