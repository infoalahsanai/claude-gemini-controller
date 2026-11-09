document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('modelSelect');
  const enabledSwitch = document.getElementById('enabledSwitch');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const statusBadge = document.getElementById('statusBadge');

  // Load saved settings
  chrome.storage.sync.get(['geminiApiKey', 'geminiModel', 'controllerEnabled'], (data) => {
    if (data.geminiApiKey) apiKeyInput.value = data.geminiApiKey;
    if (data.geminiModel) modelSelect.value = data.geminiModel;
    if (typeof data.controllerEnabled !== 'undefined') {
      enabledSwitch.checked = data.controllerEnabled;
    }
  });

  function showStatus(text, type) {
    statusBadge.textContent = text;
    statusBadge.className = `status-badge ${type}`;
    setTimeout(() => {
      if (type === 'success') {
        statusBadge.style.display = 'none';
      }
    }, 4000);
  }

  // Save Settings
  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value;
    const enabled = enabledSwitch.checked;

    if (!key) {
      showStatus('⚠️ অনুগ্রহ করে Google API Key লিখুন!', 'error');
      return;
    }

    chrome.storage.sync.set({
      geminiApiKey: key,
      geminiModel: model,
      controllerEnabled: enabled
    }, () => {
      showStatus('✓ সফলভাবে সেভ হয়েছে! Claude.ai রিলোড করুন।', 'success');
    });
  });

  // Test API Key
  testBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value || 'gemini-1.5-flash';

    if (!key) {
      showStatus('⚠️ পরীক্ষার জন্য আগে API Key লিখুন!', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'টেস্ট করা হচ্ছে...';
    showStatus('Google সার্ভারে সংযোগ চেক করা হচ্ছে...', 'success');

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello, reply with only: OK' }] }]
        })
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error.message || 'API Key সঠিক নয়');
      }

      showStatus('✓ চমৎকার! আপনার Google API Key সক্রিয় ও কার্যকরী!', 'success');
    } catch (err) {
      showStatus('❌ ত্রুটি: ' + err.message, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '⚡ Test API Key';
    }
  });
});
