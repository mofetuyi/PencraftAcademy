/* ================================================================
   PENCRAFT ACADEMY — Penny AI Chatbot
   Multi-tier backend proxy integration + smart markdown renderer
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const chatWidget = document.getElementById('pennyChat');
  const chatToggle = document.getElementById('pennyToggle');
  const chatMinimize = document.getElementById('pennyMinimize');
  const chatMessages = document.getElementById('pennyMessages');
  const chatForm = document.getElementById('pennyForm');
  const chatInput = document.getElementById('pennyInput');
  const suggestions = document.querySelectorAll('.penny-suggestion');

  // Session ID for conversation continuity
  const sessionId = 'penny_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);

  let isOpen = false;
  let isWaiting = false;

  // --- Toggle chat ---
  if (chatToggle && chatWidget) {
    chatToggle.addEventListener('click', () => {
      isOpen = !isOpen;
      chatWidget.classList.toggle('open', isOpen);
      chatToggle.classList.toggle('active', isOpen);

      if (isOpen) {
        chatInput.focus();
        const notif = document.getElementById('pennyNotification');
        if (notif) notif.style.display = 'none';
      }
    });
  }

  // --- Minimize chat ---
  if (chatMinimize && chatWidget) {
    chatMinimize.addEventListener('click', () => {
      isOpen = false;
      chatWidget.classList.remove('open');
      if (chatToggle) chatToggle.classList.remove('active');
    });
  }

  // --- Send message ---
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = chatInput.value.trim();
      if (!message || isWaiting) return;
      sendMessage(message);
    });
  }

  // --- Quick suggestions ---
  suggestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.msg;
      if (msg && !isWaiting) {
        sendMessage(msg);
      }
    });
  });

  async function sendMessage(message) {
    appendMessage(message, 'user');
    chatInput.value = '';
    isWaiting = true;

    // Hide suggestions after interaction
    const suggestionsContainer = document.getElementById('pennySuggestions');
    if (suggestionsContainer) suggestionsContainer.style.display = 'none';

    // Typing indicator
    const typingEl = showTyping();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
      });

      const data = await response.json();
      removeTyping(typingEl);

      if (data && data.reply) {
        appendMessage(data.reply, 'bot');
      } else if (data && data.error) {
        appendMessage(data.error, 'bot');
      } else {
        appendMessage("I'm right here! Could you please repeat or rephrase that for me?", 'bot');
      }
    } catch (error) {
      console.warn('Penny fetch error:', error);
      removeTyping(typingEl);
      appendMessage(
        "I had a brief connection pause. Please try asking again in a moment—I'm ready to answer any question! ✨",
        'bot'
      );
    }

    isWaiting = false;
    chatInput.focus();
  }

  function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `penny-message penny-${sender}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'penny-msg-avatar';
    avatarDiv.textContent = sender === 'bot' ? '✨' : '👤';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'penny-msg-content';
    contentDiv.innerHTML = formatResponse(text);

    msgDiv.appendChild(avatarDiv);
    msgDiv.appendChild(contentDiv);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function formatResponse(text) {
    if (!text) return '';

    // Extract code blocks first to protect them from inline markdown formatting
    const codeBlocks = [];
    let processed = text.replace(/```([a-zA-Z0-9_\-\+]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlocks.length;
      const cleanCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      codeBlocks.push(`<pre style="background: rgba(10,22,40,0.06); padding: 0.75rem 1rem; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 0.85rem; margin: 0.5rem 0; border: 1px solid rgba(10,22,40,0.08);"><code>${cleanCode.trim()}</code></pre>`);
      return `__CODE_BLOCK_${idx}__`;
    });

    let html = processed
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`\n]+)`/g, '<code style="background: rgba(10,22,40,0.06); padding: 0.15rem 0.35rem; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">$1</code>')
      // Markdown links: [Text](url)
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--gold-600); font-weight: 600; text-decoration: underline;">$1</a>')
      // Bullet points
      .replace(/^[\s]*[•\-\*]\s+(.+)/gm, '<li>$1</li>')
      // Numbered lists
      .replace(/^[\s]*([0-9]+)\.\s+(.+)/gm, '<li><strong>$1.</strong> $2</li>')
      // Line breaks
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Wrap consecutive list items
    html = html.replace(/((<li>.*?<\/li>\s*)+)/g, '<ul style="margin: 0.5rem 0; padding-left: 1.25rem;">$1</ul>');

    // Restore code blocks
    codeBlocks.forEach((cb, idx) => {
      html = html.replace(`__CODE_BLOCK_${idx}__`, cb);
    });

    if (!html.startsWith('<p>') && !html.startsWith('<ul>') && !html.startsWith('<pre>')) {
      html = `<p>${html}</p>`;
    }

    return html;
  }

  function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'penny-message penny-bot penny-typing-msg';

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'penny-msg-avatar';
    avatarDiv.textContent = '✨';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'penny-msg-content';
    contentDiv.innerHTML = `
      <div class="penny-typing">
        <span></span><span></span><span></span>
      </div>
    `;

    typingDiv.appendChild(avatarDiv);
    typingDiv.appendChild(contentDiv);
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return typingDiv;
  }

  function removeTyping(el) {
    if (el && el.parentNode) {
      el.remove();
    }
  }

  // --- Keyboard shortcut: Escape to close ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      chatWidget.classList.remove('open');
      if (chatToggle) chatToggle.classList.remove('active');
    }
  });
});
