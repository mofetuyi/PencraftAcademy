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
      imgSrc: ["'self'", "data:", "blob:", "https://*"],
      frameSrc: ["'self'", "https://drive.google.com", "https://docs.google.com"],
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

const PENNY_SYSTEM_PROMPT = `You are Penny, the smart, friendly, highly capable, and encouraging AI assistant for Pencraft Academy.

CORE INFORMATION ABOUT PENCRAFT ACADEMY:
- Tagline: "Turning Ideas Into Skills. Turning Skills Into Value."
- Founder & Director: Osuigwe Wisdom Munachimso (Prince Noble).
- Purpose: A learning and skills-development initiative to help learners gain practical knowledge, build useful skills, and prepare for educational, professional, and entrepreneurial opportunities.
- Core Values: Integrity, Discipline, Accountability, Excellence, Respect, Creativity, Collaboration, Transparency, Continuous Learning.
- Mission: Accessible, practical, and ethical skills education through practice, feedback, and teamwork.
- Vision: To become a trusted skills-development academy building capable, creative, disciplined, and ethical individuals.

COURSES STATUS:
- ACTIVE COURSE: "Digital Marketing" (the only course offered). Covers social media strategy, content creation & copywriting, SEO & analytics, branding, email marketing, and paid advertising.

CONTACT INFO:
- Official WhatsApp: +234 708 692 2596 (chat link: https://wa.me/2347086922596)

HOW TO APPLY:
- Direct learners to click the gold "Apply for a Course" button located on the top navbar or contact page, which links to the official enrollment form: https://docs.google.com/forms/d/e/1FAIpQLScDq_i3W1olkoYo17hHQp5rpeZVwmY-eYeSrigO8A860j8cMA/viewform?usp=publish-editor

CERTIFICATION:
- Certificate of Completion: Awarded to every student who successfully completes their course modules, practical exercises, and capstone project. There are no separate tiers; all qualifying graduates earn the official Certificate of Completion.

WEBSITE NAVIGATION:
- Home: index.html
- About Us: about.html
- Courses: courses.html
- Contact & Apply: contact.html

UNIVERSAL KNOWLEDGE & ASSISTANCE GUIDELINES:
- You are a full-fledged intelligent assistant. Answer ANY and ALL questions the user asks you across all topics and domains.
- Never refuse a question or say you are only allowed to discuss the academy.
- If asked about digital marketing, SEO, copywriting, or ads: provide actionable, in-depth, expert advice.
- If asked about writing, editing, or grammar: provide constructive reviews, suggestions, and corrections.
- If asked about career growth, freelancing, portfolio design, or client pitching: share proven, practical tips.
- If asked general knowledge questions (coding, technology, history, science, math, life advice, creative brainstorming, productivity): answer accurately, helpfully, and thoroughly.
- Tone: Warm, articulate, sharp, and empowering. Use clean markdown formatting (bolding, bullet points, numbered lists) so your answers are effortless to read.`;

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
    return `🎓 **Our Program:**

We offer a comprehensive **Digital Marketing** course covering:
• Social media management & brand growth
• High-conversion copywriting & content creation
• Search Engine Optimization (SEO) & analytics
• Email marketing, funnels & paid ads

View full curriculum on our [Courses page](courses.html) or click **Apply for a Course** to join! 🚀`;
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

  if (q.includes('certif') || q.includes('diploma') || q.includes('pass') || q.includes('graduate')) {
    return `🏆 **Certificate of Completion:**

Pencraft Academy awards an official **Certificate of Completion** to every student who successfully completes all course modules, practical exercises, and the final capstone project.

View details on our [Courses](courses.html#certification) page! 📜✨`;
  }

  if (q.includes('rule') || q.includes('discipline') || q.includes('rights') || q.includes('value')) {
    return `📜 **Core Values & Community Standards:**

Pencraft Academy operates with strict standards of integrity, respect, and excellence.
• 9 Core Values including Integrity, Discipline, Respect, and Transparency.
• Supportive, practical learning environment focused on ethical growth.

Learn more about our standards on the [About Us](about.html) page! ✨`;
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

  if (q.includes('seo') || q.includes('search engine')) {
    return `🔍 **What is SEO (Search Engine Optimization)?**

SEO is the practice of optimizing your website and content to rank higher in unpaid (organic) search engine results like Google.

**Key Pillars of SEO:**
• **Keyword Research:** Discovering terms your target audience searches for.
• **On-Page SEO:** Crafting compelling title tags, headings, content, and internal links.
• **Technical SEO:** Fast page speed, mobile-friendliness, and clean site structure.
• **Backlinks (Off-Page):** Earning credible links from reputable websites.

Mastering SEO is a core part of our **Digital Marketing** course at Pencraft Academy! 🚀`;
  }

  if (q.includes('copywriting') || q.includes('content') || q.includes('write') || q.includes('writing')) {
    return `✍️ **Effective Copywriting Tips:**

1. **Know Your Audience:** Write directly to one person's desires and pain points.
2. **Lead with Benefits, Not Just Features:** Don't just say what a product does—show how it transforms the user's life.
3. **Hook in the First 3 Seconds:** Use bold headlines and curiosity-provoking openers.
4. **Clear Call-to-Action (CTA):** Tell the reader precisely what to do next (e.g. *"Join today"*, *"Claim your guide"*).
5. **Edit Ruthlessly:** Cut fluff, simplify complex phrasing, and keep sentences punchy.

We teach actionable copywriting inside our **Digital Marketing** program! ✨`;
  }

  if (q.includes('freelance') || q.includes('client') || q.includes('portfolio') || q.includes('money')) {
    return `💼 **Key Steps to Succeed in Freelancing:**

1. **Pick One High-Income Skill:** Specialize in an in-demand area (like Digital Marketing, Copywriting, or Web Design).
2. **Build Proof of Work:** Create 2–3 comprehensive case studies or sample projects even before having your first client.
3. **Outreach & Networking:** Engage on LinkedIn, Twitter/X, and freelance platforms with personalized, value-first proposals.
4. **Deliver Exceptional Quality:** Over-deliver on deadlines and maintain proactive communication.

Pencraft Academy is built on turning skills into tangible market value! 🌟`;
  }

  return `Hello! I'm **Penny**, your AI assistant. ✨

I can help you with anything you need—from answering questions about **Digital Marketing**, **writing**, **SEO**, and **career skills**, to guiding you through enrolling at Pencraft Academy!

• To apply for our active cohort, click the **"Apply for a Course"** button.
• To speak with our team, chat with us on WhatsApp at **[+234 708 692 2596](https://wa.me/2347086922596)**.

Feel free to ask me any question! What would you like to know or learn today? 🎓`;
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

const { fetchStudents, findStudentMatch } = require('./lib/studentStore');
const { createToken, verifyToken, checkRateLimit, recordFailedAttempt, resetFailedAttempts } = require('./lib/auth');
const classStore = require('./lib/classStore');

const ASSIGNMENT_FORM_URL = process.env.ASSIGNMENT_FORM_URL || 'https://forms.gle/1bzbqAZr9zzqfLmo9';
const DRIVE_FOLDER_URL = (process.env.DRIVE_FOLDER_URL && !process.env.DRIVE_FOLDER_URL.includes('sample_folder_id')) ? process.env.DRIVE_FOLDER_URL : '';

// Auth middleware for portal
function authenticatePortal(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-portal-token'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Access denied. Please sign in to the student portal.',
      authenticated: false
    });
  }

  req.portalUser = payload;
  next();
}

// Admin only middleware
function requireAdmin(req, res, next) {
  authenticatePortal(req, res, () => {
    if (req.portalUser && req.portalUser.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Access restricted to administrator.' });
    }
  });
}

// --- Student Login Endpoint ---
app.post('/api/portal/login', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown_ip';
  const { studentId = '', fullName = '', firstName = '', lastName = '' } = req.body || {};

  const cleanId = studentId.trim();
  const cleanFirst = firstName.trim();
  const cleanLast = lastName.trim();
  const cleanName = (fullName.trim() || `${cleanFirst} ${cleanLast}`).trim();

  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: rateCheck.message });
  }

  if (!cleanId || (!cleanName && (!cleanFirst || !cleanLast))) {
    return res.status(400).json({ error: 'Please enter your Student ID, First Name, and Last Name.' });
  }

  try {
    const students = await fetchStudents();
    const matched = findStudentMatch(students, cleanId, cleanName, cleanFirst, cleanLast);

    if (!matched) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({
        error: "We couldn't find you in our student records. Please check your Student ID, First Name, and Last Name, or contact the academy."
      });
    }

    // Success - reset attempts
    resetFailedAttempts(clientIp);

    // Create session token (valid 7 days)
    const displayStudentId = matched.studentId || cleanId;
    const displayFullName = matched.fullName || cleanName;

    const token = createToken({
      studentId: displayStudentId,
      fullName: displayFullName,
      role: 'student',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      token,
      student: {
        studentId: displayStudentId,
        fullName: displayFullName,
        role: 'student'
      }
    });
  } catch (err) {
    console.error('Portal login error:', err);
    return res.status(500).json({
      error: "We couldn't find you in our student records. Please check your Student ID and name, or contact the academy."
    });
  }
});

// --- Admin Login Endpoint ---
app.post('/api/portal/admin-login', (req, res) => {
  const clientIp = req.ip || 'unknown_ip';
  const { password = '' } = req.body || {};

  const rateCheck = checkRateLimit(`admin_${clientIp}`);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: rateCheck.message });
  }

  const adminPass = process.env.ADMIN_PASSWORD || 'pencraftadmin2026';
  if (password !== adminPass) {
    recordFailedAttempt(`admin_${clientIp}`);
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  resetFailedAttempts(`admin_${clientIp}`);

  const token = createToken({
    role: 'admin',
    fullName: 'Academy Administrator',
    exp: Date.now() + 2 * 24 * 60 * 60 * 1000
  });

  return res.json({
    success: true,
    token,
    user: {
      role: 'admin',
      fullName: 'Academy Administrator'
    }
  });
});

// --- Get Current Session Profile & Config ---
app.get('/api/portal/me', authenticatePortal, (req, res) => {
  res.json({
    user: req.portalUser,
    config: {
      assignmentFormUrl: ASSIGNMENT_FORM_URL,
      driveFolderUrl: DRIVE_FOLDER_URL
    }
  });
});

// --- Get Classes (Protected: Student or Admin) ---
app.get('/api/portal/classes', authenticatePortal, (req, res) => {
  const classes = classStore.getClasses();
  res.json({
    classes,
    assignmentFormUrl: ASSIGNMENT_FORM_URL,
    driveFolderUrl: DRIVE_FOLDER_URL
  });
});

// --- Admin Class CRUD Endpoints ---
app.post('/api/portal/classes', requireAdmin, (req, res) => {
  const { title, date, driveUrl, notes } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Class title is required.' });
  }
  const created = classStore.addClass({ title, date, driveUrl, notes });
  res.status(201).json({ success: true, class: created });
});

app.put('/api/portal/classes/:id', requireAdmin, (req, res) => {
  const updated = classStore.updateClass(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ error: 'Class not found.' });
  }
  res.json({ success: true, class: updated });
});

app.delete('/api/portal/classes/:id', requireAdmin, (req, res) => {
  const deleted = classStore.deleteClass(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Class not found.' });
  }
  res.json({ success: true });
});

// Explicit Portal Route
app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
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
  ║   Pages:   Home, About, Courses, Portal, Terms, Privacy, Contact║
  ║   AI:      Penny Multi-tier Active ✨            ║
  ╚══════════════════════════════════════════════════╝
  `);
});
