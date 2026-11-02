/* ================================================================
   PENCRAFT ACADEMY — Penny AI Chatbot
   Integrates with the backend Gemini API proxy
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
  const sessionId = 'penny_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

  let isOpen = false;
  let isWaiting = false;

  // --- Toggle chat ---
  chatToggle.addEventListener('click', () => {
    isOpen = !isOpen;
    chatWidget.classList.toggle('open', isOpen);
    chatToggle.classList.toggle('active', isOpen);

    if (isOpen) {
      chatInput.focus();
      // Hide notification dot
      document.getElementById('pennyNotification').style.display = 'none';
    }
  });

  // --- Minimize chat ---
  chatMinimize.addEventListener('click', () => {
    isOpen = false;
    chatWidget.classList.remove('open');
    chatToggle.classList.remove('active');
  });

  // --- Send message ---
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message || isWaiting) return;
    sendMessage(message);
  });

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
    // Add user message
    appendMessage(message, 'user');
    chatInput.value = '';
    isWaiting = true;

    // Hide suggestions after first message
    const suggestionsContainer = document.getElementById('pennySuggestions');
    suggestionsContainer.style.display = 'none';

    // Show typing indicator
    const typingEl = showTyping();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
      });

      const data = await response.json();

      // Remove typing indicator
      removeTyping(typingEl);

      if (data.error) {
        appendMessage(data.error, 'bot');
      } else {
        appendMessage(data.reply, 'bot');
      }
    } catch (error) {
      removeTyping(typingEl);
      appendMessage(
        "Sorry, I'm having trouble connecting right now. Please try again in a moment! 💫",
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

    // Parse markdown-like formatting
    contentDiv.innerHTML = formatResponse(text);

    msgDiv.appendChild(avatarDiv);
    msgDiv.appendChild(contentDiv);
    chatMessages.appendChild(msgDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function formatResponse(text) {
    // Convert markdown-like text to HTML
    let html = text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Line breaks
      .replace(/\n/g, '<br>')
      // Bullet points
      .replace(/^[-•]\s+(.+)/gm, '<li>$1</li>');

    // Wrap consecutive <li> elements in <ul>
    html = html.replace(/((<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');

    // Wrap in paragraph if no HTML tags found
    if (!html.includes('<')) {
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

  // --- Auto-show notification after 5 seconds ---
  setTimeout(() => {
    if (!isOpen) {
      document.getElementById('pennyNotification').style.display = 'block';
    }
  }, 5000);

  // --- Keyboard shortcut: Escape to close ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      isOpen = false;
      chatWidget.classList.remove('open');
      chatToggle.classList.remove('active');
    }
  });
});
