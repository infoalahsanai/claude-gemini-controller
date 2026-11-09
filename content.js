// Claude AI - Gemini Controller Content Script

(function () {
  console.log('[Claude-Gemini] Controller initialized');

  let state = {
    apiKey: '',
    model: 'gemini-1.5-flash',
    enabled: true,
    history: []
  };

  // Load config
  chrome.storage.sync.get(['geminiApiKey', 'geminiModel', 'controllerEnabled'], (data) => {
    if (data.geminiApiKey) state.apiKey = data.geminiApiKey;
    if (data.geminiModel) state.model = data.geminiModel;
    if (typeof data.controllerEnabled !== 'undefined') state.enabled = data.controllerEnabled;
    init();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.geminiApiKey) state.apiKey = changes.geminiApiKey.newValue;
    if (changes.geminiModel) state.model = changes.geminiModel.newValue;
    if (changes.controllerEnabled) {
      state.enabled = changes.controllerEnabled.newValue;
      updateWidgetVisibility();
    }
  });

  function init() {
    createFloatingWidget();
    observeDOM();
  }

  function updateWidgetVisibility() {
    const widget = document.getElementById('clg-floating-widget');
    if (widget) {
      widget.style.display = state.enabled ? 'flex' : 'none';
    }
    const sendBtn = document.getElementById('clg-custom-send-btn');
    if (sendBtn) {
      sendBtn.style.display = state.enabled ? 'inline-flex' : 'none';
    }
  }

  // Floating Widget on Mobile / Desktop
  function createFloatingWidget() {
    if (document.getElementById('clg-floating-widget')) return;

    const container = document.createElement('div');
    container.id = 'clg-floating-widget';
    container.style.display = state.enabled ? 'flex' : 'none';

    container.innerHTML = `
      <div id="clg-panel" class="clg-panel">
        <div class="clg-panel-header">
          <span class="clg-panel-title">⚡ Gemini Controller</span>
          <button id="clg-panel-close" class="clg-panel-close">&times;</button>
        </div>
        <div class="clg-panel-body">
          <p><strong>Status:</strong> ${state.apiKey ? '🟢 Key Configured' : '🔴 No Key Set'}</p>
          <p><strong>Model:</strong> ${state.model}</p>
          <p style="margin-top:6px; font-size:11px; color:#a6a095;">Claude-এর লিমিট শেষ হলেও এই এক্সটেনশন দিয়ে আপনি সরাসরি Google Key-এর মাধ্যমে কথা বলতে পারবেন।</p>
        </div>
        <button id="clg-clear-history-btn" class="clg-quick-btn">🗑️ Clear Chat History</button>
      </div>
      <div id="clg-badge" class="clg-badge" title="Tap to open controls">
        <span>⚡ Gemini Free</span>
      </div>
    `;

    document.body.appendChild(container);

    const badge = document.getElementById('clg-badge');
    const panel = document.getElementById('clg-panel');
    const closeBtn = document.getElementById('clg-panel-close');
    const clearBtn = document.getElementById('clg-clear-history-btn');

    badge.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
    });

    closeBtn.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    clearBtn.addEventListener('click', () => {
      state.history = [];
      alert('কথোপকথনের হিস্টোরি ক্লিয়ার করা হয়েছে!');
      panel.style.display = 'none';
    });
  }

  // Find Claude's input & attach custom button
  function injectSendButton() {
    if (!state.enabled) return;
    if (document.getElementById('clg-custom-send-btn')) return;

    // Look for Claude's prompt form or input controls
    const inputArea = document.querySelector('div[contenteditable="true"]') || 
                      document.querySelector('textarea') ||
                      document.querySelector('fieldset');

    if (!inputArea) return;

    // Look for Claude's native send button or parent controls
    const parentContainer = inputArea.closest('fieldset') || 
                            inputArea.parentElement?.parentElement || 
                            inputArea.parentElement;

    if (!parentContainer) return;

    const btn = document.createElement('button');
    btn.id = 'clg-custom-send-btn';
    btn.className = 'clg-send-btn';
    btn.type = 'button';
    btn.innerHTML = `⚡ Gemini Send`;
    btn.title = 'Send using your Google Gemini Free API Key';

    btn.addEventListener('click', handleGeminiSend);

    // Try finding the bottom action bar inside Claude's input box
    const actionBar = parentContainer.querySelector('div.flex.items-center.justify-between') ||
                      parentContainer.querySelector('div.flex.gap-2') ||
                      parentContainer;

    actionBar.appendChild(btn);
  }

  // Handle Send
  async function handleGeminiSend() {
    if (!state.apiKey) {
      alert('অনুগ্রহ করে এক্সটেনশনের Popup আইকনে ক্লিক করে আপনার Google Gemini API Key বসান!');
      return;
    }

    const inputEl = document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
    if (!inputEl) return;

    let text = (inputEl.innerText || inputEl.value || '').trim();
    if (!text) return;

    // Clear input
    if (inputEl.isContentEditable) {
      inputEl.innerText = '';
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      inputEl.value = '';
    }

    // Find conversation container
    let chatContainer = document.querySelector('main') || document.body;

    // Append User Message Bubble
    appendUserBubble(chatContainer, text);

    // Append Bot Message Bubble (Loading)
    const botElements = appendBotBubble(chatContainer);
    botElements.content.innerHTML = `<span class="clg-pulse">Gemini ভাবছে ও উত্তর লিখছে...</span>`;

    // Scroll to bottom
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

    // Add to history
    state.history.push({
      role: 'user',
      parts: [{ text: text }]
    });

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:generateContent?key=${state.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: state.history
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'API Error');
      }

      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'কোনো উত্তর পাওয়া যায়নি।';

      // Save to history
      state.history.push({
        role: 'model',
        parts: [{ text: replyText }]
      });

      // Render Markdown formatted text
      botElements.content.innerHTML = formatMarkdown(replyText);

      // Setup Copy Button
      botElements.copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(replyText);
        botElements.copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { botElements.copyBtn.textContent = '📋 Copy'; }, 2000);
      });

      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (err) {
      botElements.content.innerHTML = `<span style="color:#ef4444;">❌ ত্রুটি: ${err.message}</span>`;
    }
  }

  function appendUserBubble(parent, text) {
    const wrap = document.createElement('div');
    wrap.className = 'clg-chat-user';
    wrap.innerHTML = `<div class="clg-chat-user-bubble">${escapeHtml(text)}</div>`;
    parent.appendChild(wrap);
  }

  function appendBotBubble(parent) {
    const wrap = document.createElement('div');
    wrap.className = 'clg-chat-bot';
    wrap.innerHTML = `
      <div class="clg-chat-bot-header">
        <div class="clg-chat-bot-avatar">⚡</div>
        <span class="clg-chat-bot-name">Claude (Powered by Gemini)</span>
        <span class="clg-chat-bot-tag">Free API</span>
      </div>
      <div class="clg-chat-bot-content"></div>
      <div class="clg-chat-bot-actions">
        <button class="clg-copy-btn">📋 Copy</button>
      </div>
    `;
    parent.appendChild(wrap);

    return {
      container: wrap,
      content: wrap.querySelector('.clg-chat-bot-content'),
      copyBtn: wrap.querySelector('.clg-copy-btn')
    };
  }

  // Simple Markdown Parser
  function formatMarkdown(md) {
    if (!md) return '';
    let html = escapeHtml(md);

    // Code blocks
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold & Italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Line breaks to <br> outside <pre>
    const parts = html.split(/(<pre>[\s\S]*?<\/pre>)/g);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].startsWith('<pre>')) {
        parts[i] = parts[i].replace(/\n/g, '<br>');
      }
    }

    return parts.join('');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Observer to re-inject button when URL or SPA views change
  function observeDOM() {
    injectSendButton();
    const observer = new MutationObserver(() => {
      injectSendButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

})();
