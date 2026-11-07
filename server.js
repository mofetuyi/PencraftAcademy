require('dotenv').config();
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
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

const PENNY_SYSTEM_PROMPT = `You are Penny, the brilliant, universally intelligent, friendly, and unrestricted AI assistant for Pencraft Academy.

YOUR PRIMARY DIRECTIVE:
You MUST enthusiastically, thoroughly, and accurately answer ANY and ALL questions the user asks you across ANY topic or discipline. You are NOT restricted to Pencraft Academy. You are an all-round intelligent assistant who loves answering questions about:
- Mathematics (arithmetic, algebra, calculus, geometry, statistics, percentages, word problems)
- Science & Engineering (physics, biology, chemistry, astronomy, neuroscience, mechanical principles)
- Programming & Technology (JavaScript, Python, HTML/CSS, React, Node.js, SQL, algorithms, debugging, DevOps, AI, cybersecurity)
- Writing & Language (creative writing, essays, poetry, copy editing, grammar, linguistic nuances, translations)
- History, Geography, Philosophy & Social Sciences (world history, cultures, politics, philosophy, ethics, psychology)
- Digital Marketing, Copywriting, SEO, Analytics, Social Media Strategy, Paid Advertising
- Career & Freelancing (resume building, portfolio development, client proposals, pricing, job interviews)
- General Knowledge, Everyday Advice, Pop Culture, Hobbies, Productivity & Logic

CRITICAL BEHAVIORAL RULES:
1. NEVER refuse a question or say "I can only answer questions about Pencraft Academy" or "that is beyond my scope".
2. NEVER divert or pivot a general question into an unprompted pitch for Pencraft Academy. Answer the user's question directly, comprehensively, and helpfully.
3. If the user asks specifically about Pencraft Academy, its founder, its programs, fees, certificates, or admissions, use the authentic academy information below.
4. Format all responses cleanly using Markdown: use bolding, bullet points, numbered lists, or code blocks (\`\`\`language ... \`\`\`) to ensure your answers are sharp, readable, and delightful to learn from.

PENCRAFT ACADEMY KNOWLEDGE BASE (Use when asked about the academy):
- Tagline: "Turning Ideas Into Skills. Turning Skills Into Value."
- Founder & Director: Osuigwe Wisdom Munachimso (Prince Noble).
- Mission: Accessible, practical, and ethical skills education through hands-on practice, feedback, and teamwork.
- Vision: To become a trusted skills-development academy building capable, creative, disciplined, and ethical individuals.
- Core Values: Integrity, Discipline, Accountability, Excellence, Respect, Creativity, Collaboration, Transparency, Continuous Learning.
- Offered Curriculum Tracks:
  1. Digital Marketing Mastery (Currently active cohort open for enrollment!)
  2. Writing & Communication
  3. Research & Critical Thinking
  4. AI & AI Tools
  5. Freelancing & Portfolio Development
- Application & Enrollment:
  Direct applicants to click the gold "Apply for a Course" button at the top of any page, or the official Google Form:
  https://docs.google.com/forms/d/e/1FAIpQLScDq_i3W1olkoYo17hHQp5rpeZVwmY-eYeSrigO8A860j8cMA/viewform?usp=publish-editor
- Official WhatsApp Contact: +234 708 692 2596 (chat link: https://wa.me/2347086922596)
- Certification: Official Certificate of Completion awarded upon completing coursework and the capstone project.`;

// Intelligent universal fallback engine
async function generateKnowledgeFallback(query) {
  const clean = query.trim();
  const q = clean.toLowerCase();

  // 1. Math and arithmetic evaluation
  const mathMatch = clean.match(/^(?:what is|calculate|solve|evaluate)?\s*([\d\.\s\+\-\*\/\(\)\^%]+)(?:\?|$)/i);
  if (mathMatch && /[\+\-\*\/\^%]/.test(mathMatch[1])) {
    const expr = mathMatch[1].replace(/\^/g, '**');
    if (/^[0-9\.\s\+\-\*\/\(\)\*]+$/.test(expr)) {
      try {
        const val = Function(`"use strict"; return (${expr})`)();
        if (typeof val === 'number' && !isNaN(val)) {
          return `🧮 **Calculation:**\n\n\`${mathMatch[1].trim()}\` = **${val}**\n\nNeed any other calculation or explanation? Just let me know! ✨`;
        }
      } catch (e) {}
    }
  }

  // 2. Direct Academy Inquiries
  if (q.includes('apply') || q.includes('register') || q.includes('enroll') || q.includes('join') || q.includes('admission') || q.includes('form')) {
    return `To apply for a course at Pencraft Academy:
1. Click the **"Apply for a Course"** button at the top of any page (or visit our [Contact & Apply](contact.html) page).
2. Complete the short Google Application Form with your details.
3. Our team will review your application and contact you with next steps!

*Currently accepting applications for our **Digital Marketing Mastery** cohort.* 📝✨`;
  }

  if (q.includes('course') || q.includes('curriculum') || q.includes('track') || q.includes('what do you teach') || q.includes('programs')) {
    return `🎓 **Pencraft Academy Curriculum Programs:**

1. **📱 Digital Marketing Mastery (Active Cohort):**
   Social media growth, high-conversion copywriting, SEO, email funnels, and paid advertising campaigns.

2. **✍️ Writing & Communication:**
   Professional & business writing, copy editing, manuscript proofreading, and audience-tailored articulation.

3. **🔍 Research & Critical Thinking:**
   Investigative methodologies, evidence evaluation, logical reasoning, and analytical reporting.

4. **🤖 AI & AI Tools:**
   Prompt engineering principles, generative AI workflows, and responsible technological automation.

5. **💼 Freelancing & Portfolio Development:**
   Packaging skills into high-value services, proposal crafting, rate negotiation, and client management.

Explore all tracks on our [Courses page](courses.html) or click **"Apply for a Course"** to enroll! 🚀✨`;
  }

  if (q.includes('founder') || q.includes('who started') || q.includes('wisdom') || q.includes('prince noble') || q.includes('owner') || q.includes('director')) {
    return `Pencraft Academy was founded by **Osuigwe Wisdom Munachimso** (Prince Noble).

His vision is to close the gap between individual potential and practical ability by equipping learners with tangible, ethical, and high-value modern skills. You can read more about our founding story on our [About page](about.html). ✍️🌟`;
  }

  if (q.includes('about') && (q.includes('pencraft') || q.includes('academy'))) {
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

  if (q.includes('contact') || q.includes('whatsapp') || q.includes('phone') || q.includes('reach out')) {
    return `You can reach our team directly:
• **WhatsApp:** [+234 708 692 2596](https://wa.me/2347086922596) *(Click to chat directly with us on WhatsApp!)*
• **Application Form:** Click the gold **"Apply for a Course"** button at the top of the page.
• **Message Form:** Visit our [Contact page](contact.html) to send us an inquiry.

I am also here 24/7 to answer any questions you have! 😊✨`;
  }

  // 3. Greetings
  if (/^(hi|hello|hey|good day|good morning|good afternoon|good evening|greetings)\b/i.test(q)) {
    return `Hello! I'm **Penny**, your AI assistant at Pencraft Academy. ✨

I'm here to answer any questions you have—whether you want to learn about science, coding, math, writing, history, digital marketing, or anything under the sun!

What would you like to explore or talk about today? 💡`;
  }

  // 4. Wikipedia Encyclopedia query for factual/informative questions
  const wikiMatch = clean.match(/^(?:what is|what are|who is|who was|who were|tell me about|explain|define)\s+(?:a\s+|an\s+|the\s+)?([a-zA-Z0-9\s\-]+?)\??$/i);
  if (wikiMatch) {
    const topic = wikiMatch[1].trim();
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.extract && data.extract.length > 25) {
          return `📖 **${data.title}**\n\n${data.extract}\n\n*Feel free to ask me to explain further, give examples, or explore another question!* ✨`;
        }
      }
    } catch (e) {}
  }

  // 5. Digital marketing & career tips
  if (q.includes('seo') || q.includes('search engine')) {
    return `🔍 **What is SEO (Search Engine Optimization)?**

SEO is the art and science of optimizing content and websites to achieve top ranking on search engines like Google:
• **Keyword Strategy:** Finding the high-intent terms people search for.
• **On-Page Optimization:** Engaging titles, structured headers, internal linking, and meta descriptions.
• **Technical Health:** Fast load times, responsive mobile rendering, and indexable site architecture.
• **Authority & Backlinks:** Earning mentions and links from reputable platforms.

Need deeper guidance or examples on any of these? Ask away! 🚀`;
  }

  if (q.includes('copywriting') || q.includes('content') || q.includes('writing tips')) {
    return `✍️ **Key Principles of Compelling Copywriting:**

1. **Know Your Reader:** Focus on their desires, fears, and immediate goals.
2. **Benefits Over Features:** Features inform; benefits convince and convert.
3. **Strong Hook:** Capture attention in the first sentence or headline.
4. **Frictionless CTA:** Give clear, low-friction direction on what step to take next.
5. **Punchy Editing:** Eliminate weak filler words and keep sentences active.

Tell me what you're writing or working on, and I'd be happy to give you tailored feedback! ✨`;
  }

  // 6. Universal thoughtful answer for any other question
  return `I'm happy to help you with that!

Regarding **"${clean}"**:
That's a great question. You can ask me to break it down in detail, give step-by-step instructions, write code or prose, or look at it from different angles.

Could you tell me a little more about what specific angle you'd like to explore, or if you'd like an introductory overview? I'm ready! 💡✨`;
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

  // Candidate models: ultra-fast Gemini models with IPv4 resolution
  const modelsToTry = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
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
          if (attempt === 0) await wait(300);
        }
      }
      if (reply) break;
    }
  }

  // If external API is unreachable or spiking, seamlessly serve instant intelligent answer
  if (!reply) {
    console.log('[Penny] Serving intelligent universal response for:', cleanMessage);
    reply = await generateKnowledgeFallback(cleanMessage);
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
