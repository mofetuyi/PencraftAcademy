require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security middleware ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiter for the AI chat endpoint
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
});

// --- Gemini AI setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PENNY_SYSTEM_PROMPT = `You are Penny, the friendly and knowledgeable AI assistant for Pencraft Academy.

ABOUT PENCRAFT ACADEMY:
Pencraft Academy is a learning and skills-development initiative that helps learners gain practical knowledge, develop useful skills, and prepare for educational, professional, and entrepreneurial opportunities. The academy focuses on practical learning, assignments, feedback, collaboration, and responsible use of technology.

TAGLINE: "Turning Ideas Into Skills. Turning Skills Into Value."

FOUNDER: Osuigwe Wisdom Munachimso (Prince Noble)

CURRENTLY OFFERED:
- Digital Marketing (this is the only course currently available)

COMING SOON (not yet available):
- Writing, communication, editing, and proofreading
- Research and critical thinking
- Artificial intelligence (AI) and AI tools
- Freelancing and career development

MISSION: Provide accessible, practical, and ethical skills education that helps learners turn ideas into abilities and use those abilities to create value.

VISION: To become a trusted skills-development academy that helps people grow into capable, creative, disciplined, and ethical individuals.

CORE VALUES: Integrity, Discipline, Accountability, Excellence, Respect, Creativity, Collaboration, Transparency, Continuous Learning.

ASSESSMENT CLASSIFICATION:
- 70-100%: Master
- 60-69%: Senior
- 50-59%: Intermediate
- 40-49%: Apprentice
- Below 40%: Participation only

ENROLLMENT: Students can apply through the "Apply for a Course" button on the website, which links to the official Google Form.

YOUR PERSONALITY:
- Warm, encouraging, and professional
- Use clear, simple language
- Be helpful with website navigation, course information, and general questions
- If asked about something you don't know, say so honestly and suggest they contact the academy
- You can help with writing tips, study advice, and general skill-development guidance
- Keep responses concise but helpful (2-4 sentences for simple questions, more for complex ones)
- Use emojis sparingly for warmth ✨📚
- Always encourage learners and be supportive
- If someone asks how to apply, direct them to click the "Apply for a Course" button
- You can answer general questions about writing, research, AI tools, digital marketing, and freelancing`;

// Store conversation histories (in-memory; resets on server restart)
const conversations = new Map();

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- AI Chat endpoint ---
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide a message.' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message is too long. Please keep it under 2000 characters.' });
    }

    // Get or create conversation history
    let history = conversations.get(sessionId) || [];

    // Try primary model, fallback to lite if needed
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-flash-latest'];
    let reply = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: PENNY_SYSTEM_PROMPT,
        });

        const chat = model.startChat({
          history: history,
        });

        const result = await chat.sendMessage(message.trim());
        reply = result.response.text();
        if (reply) break;
      } catch (err) {
        console.warn(`Model ${modelName} failed, trying fallback:`, err.message);
        lastError = err;
      }
    }

    if (!reply) {
      throw lastError || new Error('No response from AI models');
    }

    // Update history
    history.push(
      { role: 'user', parts: [{ text: message.trim() }] },
      { role: 'model', parts: [{ text: reply }] }
    );

    // Keep last 20 exchanges to manage memory
    if (history.length > 40) {
      history = history.slice(-40);
    }

    conversations.set(sessionId, history);

    // Clean up old sessions every 100 requests
    if (conversations.size > 500) {
      const keys = Array.from(conversations.keys());
      for (let i = 0; i < 200; i++) {
        conversations.delete(keys[i]);
      }
    }

    res.json({ reply: reply });
  } catch (error) {
    console.error('Penny AI Error:', error.message);
    res.status(500).json({
      error: 'Penny is having a moment. Please try again shortly! 💫',
    });
  }
});

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Pencraft Academy', ai: 'Penny' });
});

// --- SPA fallback ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║       🎓 PENCRAFT ACADEMY SERVER RUNNING        ║
  ║                                                  ║
  ║   Local:   http://localhost:${PORT}               ║
  ║   Status:  Online                                ║
  ║   AI:      Penny is ready ✨                     ║
  ╚══════════════════════════════════════════════════╝
  `);
});
