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

// Rate limiter for the AI chat endpoint (generous so users aren't blocked)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'You are sending messages very quickly. Please wait a few seconds and try again! ⏳' },
});

// --- Gemini AI setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const PENNY_SYSTEM_PROMPT = `You are Penny, the smart, warm, and helpful AI assistant for Pencraft Academy.

CORE INFORMATION ABOUT PENCRAFT ACADEMY:
- Tagline: "Turning Ideas Into Skills. Turning Skills Into Value."
- Founder & Director: Osuigwe Wisdom Munachimso (Prince Noble).
- Purpose: A learning and skills-development initiative to help learners gain practical knowledge, build useful skills, and prepare for educational, professional, and entrepreneurial opportunities.
- Core Values: Integrity, Discipline, Accountability, Excellence, Respect, Creativity, Collaboration, Transparency, Continuous Learning.
- Mission: Accessible, practical, and ethical skills education through practice, feedback, and teamwork.
- Vision: To become a trusted skills-development academy building capable, creative, disciplined, and ethical individuals.

COURSES STATUS:
- CURRENTLY ACTIVE & OPEN: "Digital Marketing" (the only course currently accepting students). Covers social media strategy, content creation & copywriting, SEO & analytics, branding, email marketing, and paid ads.
- UPCOMING (NOT YET ACTIVE): Writing & Communication, Research & Critical Thinking, AI & AI Tools, Freelancing & Career Development.

CONTACT INFO:
- Official WhatsApp: +234 708 692 2596 (link: https://wa.me/2347086922596)
- Provide this WhatsApp link when users ask how to contact or message the academy.

HOW TO APPLY:
- Direct learners to click the gold "Apply for a Course" button located on the top navbar, course cards, or contact page.
- The button opens the official enrollment Google Form: https://docs.google.com/forms/d/e/1FAIpQLScDq_i3W1olkoYo17hHQp5rpeZVwmY-eYeSrigO8A860j8cMA/viewform?usp=publish-editor

ASSESSMENT & CERTIFICATION TIERS:
- Master: 70–100% (exceptional proficiency)
- Senior: 60–69% (strong competence)
- Intermediate: 50–59% (solid understanding)
- Apprentice: 40–49% (developing skills)
- Participation: Below 40%

DISCIPLINARY LEVELS:
- Level 1: Verbal caution
- Level 2: Written warning
- Level 3: Improvement plan / probation
- Level 4: Temporary suspension
- Level 5: Removal after fair review

WEBSITE NAVIGATION:
- Home: index.html
- About Us: about.html
- Courses: courses.html
- Foundational Charter: charter.html
- Contact & Apply: contact.html

YOUR PERSONALITY & TONE:
- Welcoming, encouraging, articulate, and professional.
- Keep answers clear, structured, and easy to read with bullet points when explaining multiple items.
- Use emojis tastefully (✨, 🎓, 📝, 💡).
- If asked how to apply, give enthusiastic step-by-step guidance.
- Always remain helpful, accurate, and supportive of learners' growth.`;

// Intelligent fallback in case external API has temporary high demand spikes
function generateKnowledgeFallback(query) {
  const q = query.toLowerCase();

  if (q.includes('apply') || q.includes('register') || q.includes('enroll') || q.includes('join') || q.includes('admission') || q.includes('form')) {
    return `To apply for a course at Pencraft Academy:
1. Click the **"Apply for a Course"** button at the top of any page (or visit our [Contact & Apply](contact.html) page).
2. Complete the short Google Application Form with your details.
3. Our team will review your application and contact you with next steps!

*Currently accepting applications for our **Digital Marketing** cohort.* 📝✨`;
  }

  if (q.includes('course') || q.includes('teach') || q.includes('offer') || q.includes('program') || q.includes('learn') || q.includes('curriculum')) {
    return `🎓 **Our Courses:**

Currently, our active course open for enrollment is:
• **Digital Marketing** — Master social media strategy, content marketing, SEO, copywriting, and brand building.

*Upcoming courses in preparation:*
• Writing, Communication & Proofreading
• Research & Critical Thinking
• Artificial Intelligence (AI) & AI Tools
• Freelancing & Career Development

You can view full details on our [Courses page](courses.html) or click **Apply for a Course** to get started! 🚀`;
  }

  if (q.includes('founder') || q.includes('who started') || q.includes('wisdom') || q.includes('prince noble') || q.includes('owner') || q.includes('director')) {
    return `Pencraft Academy was founded by **Osuigwe Wisdom Munachimso** (Prince Noble).

His vision is to close the gap between individual potential and practical ability by equipping learners with tangible, ethical, and high-value modern skills. You can read more about our founding story on our [About page](about.html). ✍️🌟`;
  }

  if (q.includes('about') || q.includes('what is pencraft') || q.includes('mission') || q.includes('vision') || q.includes('purpose')) {
    return `**Pencraft Academy** is a learning and skills-development initiative dedicated to turning ideas into skills and turning skills into value.

• **Mission:** Provide accessible, practical, and ethical skills education.
• **Vision:** Build a trusted academy where learners grow into creative, disciplined, and capable contributors to society.
• **Tagline:** *"Turning Ideas Into Skills. Turning Skills Into Value."*

Explore our story on the [About Us](about.html) page! ✨`;
  }

  if (q.includes('certif') || q.includes('grade') || q.includes('score') || q.includes('master') || q.includes('pass')) {
    return `🏆 **Assessment & Certification Levels:**

Our certificates reflect practical competence demonstrated through real assignments and projects:
• **Master:** 70–100%
• **Senior:** 60–69%
• **Intermediate:** 50–59%
• **Apprentice:** 40–49%
• **Participation:** Below 40%

Learn more on our [Courses & Assessment](courses.html) page! 📜`;
  }

  if (q.includes('charter') || q.includes('rule') || q.includes('discipline') || q.includes('rights') || q.includes('value')) {
    return `📜 **Foundational Charter & Governance:**

Pencraft Academy operates with strict standards of integrity, respect, and accountability.
• 9 Core Values including Integrity, Discipline, and Excellence.
• 5-Level progressive disciplinary process designed to correct rather than punish.
• Clear rights and protections for all students and team members.

Read the complete document on our [Foundational Charter](charter.html) page. 🛡️`;
  }

  if (q.includes('contact') || q.includes('whatsapp') || q.includes('phone') || q.includes('call') || q.includes('message') || q.includes('reach') || q.includes('help')) {
    return `You can reach our team directly:
• **WhatsApp:** [+234 708 692 2596](https://wa.me/2347086922596) *(Click to chat directly with us on WhatsApp!)*
• **Application Form:** Click the gold **"Apply for a Course"** button at the top of the page.
• **Message Form:** Visit our [Contact page](contact.html) to send us an inquiry.

I am also here 24/7 to answer any questions you have! 😊✨`;
  }

  if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.includes('good morning') || q.includes('good afternoon')) {
    return `Hello and welcome to Pencraft Academy! 🎓✨

I'm **Penny**, your AI guide. How can I help you today? You can ask me about:
• Applying for our **Digital Marketing** course
• Our mission and founder
• Certification levels & curriculum
• Navigation and general guidance!`;
  }

  return `Pencraft Academy is built on practical learning: *"Turning Ideas Into Skills. Turning Skills Into Value."*

We are currently enrolling students for our **Digital Marketing** course. You can apply right away by clicking the **"Apply for a Course"** button at the top of the page, or explore our [About](about.html), [Courses](courses.html), and [Charter](charter.html) pages for more details!

How else can I assist you? ✨`;
}

// Store conversation histories (in-memory)
const conversations = new Map();

// Helper sleep
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- AI Chat endpoint with multi-tier resilience ---
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { message, sessionId = 'default' } = req.body || {};

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Please enter a message.' });
  }

  const cleanMessage = message.trim();
  if (cleanMessage.length > 2000) {
    return res.status(400).json({ error: 'Message is too long. Please keep it under 2000 characters.' });
  }

  // Candidate models: gemini-3.8-flash, gemma-4-31b-it, gemma-4-26b-a4b-it
  const modelsToTry = ['gemini-3.8-flash', 'gemma-4-31b-it', 'gemma-4-26b-a4b-it'];
  let reply = null;

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    for (const modelName of modelsToTry) {
      // Up to 2 attempts per model with quick backoff
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: PENNY_SYSTEM_PROMPT,
          });

          // Fetch recent history
          let history = conversations.get(sessionId) || [];
          const chat = model.startChat({ history });

          const result = await Promise.race([
            chat.sendMessage(cleanMessage),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 12000))
          ]);

          const text = result?.response?.text();
          if (text && text.trim().length > 0) {
            reply = text.trim();
            // Save history
            history.push(
              { role: 'user', parts: [{ text: cleanMessage }] },
              { role: 'model', parts: [{ text: reply }] }
            );
            if (history.length > 30) history = history.slice(-30);
            conversations.set(sessionId, history);
            break;
          }
        } catch (err) {
          console.warn(`[Penny] ${modelName} attempt ${attempt + 1} notice:`, err.message);
          if (attempt === 0) await wait(400);
        }
      }
      if (reply) break;
    }
  }

  // If external API is unreachable or spiking, seamlessly serve instant intelligent answer
  if (!reply) {
    console.log('[Penny] Serving intelligent local response for:', cleanMessage);
    reply = generateKnowledgeFallback(cleanMessage);
  }

  return res.json({ reply });
});

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Pencraft Academy',
    ai: 'Penny (Multi-tier resilient)',
    timestamp: new Date().toISOString()
  });
});

// Route helper for multi-page direct links (e.g. /about, /courses, /charter, /contact)
app.get('/:page', (req, res, next) => {
  const page = req.params.page;
  const filePath = path.join(__dirname, 'public', `${page}.html`);
  res.sendFile(filePath, (err) => {
    if (err) next();
  });
});

// --- SPA / 404 fallback ---
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
  ║   Pages:   Home, About, Courses, Charter, Contact║
  ║   AI:      Penny Multi-tier Active ✨            ║
  ╚══════════════════════════════════════════════════╝
  `);
});
