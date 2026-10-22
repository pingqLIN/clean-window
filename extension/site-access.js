(() => {
  'use strict';
  const query = new URL(location.href).searchParams;
  const token = query.get('token');
  const host = document.querySelector('#target-host');
  const status = document.querySelector('#status');
  const scopeNote = document.querySelector('#scope-note');
  const allow = document.querySelector('#allow');
  const continueButton = document.querySelector('#continue');
  const cancel = document.querySelector('#cancel');
  let originPatterns = [];
  let busy = false;

  const send = type => chrome.runtime.sendMessage({ type, token });
  const setStatus = (message, kind = 'error') => {
    status.textContent = message;
    status.dataset.kind = kind;
  };
  const setEnabled = enabled => {
    for (const button of [allow, continueButton, cancel]) button.disabled = !enabled;
  };

  async function navigate(type) {
    if (busy) return;
    busy = true;
    setEnabled(false);
    try {
      const result = await send(type);
      if (!result?.ok) throw new Error(result?.error || '無法完成導覽。');
      setStatus(type === 'clean-window:site-access-complete'
        ? '已授權，正在前往…' : '正在前往…', 'info');
      window.close();
    } catch (error) {
      setStatus(error?.message || String(error));
      busy = false;
      setEnabled(true);
    }
  }

  allow.addEventListener('click', async () => {
    if (busy || !originPatterns.length) return;
    busy = true;
    setEnabled(false);
    setStatus('正在等待 Chrome 的網站存取授權…', 'info');
    try {
      // This extension-owned page is the explicit user-gesture surface for request().
      const granted = await chrome.permissions.request({ origins: originPatterns });
      if (!granted) {
        setStatus('尚未授權。你可以不授權直接前往，或取消並留在目前頁面。');
        busy = false;
        setEnabled(true);
        return;
      }
      const result = await send('clean-window:site-access-complete');
      if (!result?.ok) throw new Error(result?.error || '授權後無法繼續導覽。');
      setStatus('已授權，正在前往…', 'info');
      window.close();
    } catch (error) {
      setStatus(error?.message || String(error));
      busy = false;
      setEnabled(true);
    }
  });
  continueButton.addEventListener('click', () => void navigate('clean-window:site-access-continue'));
  cancel.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    setEnabled(false);
    try { await send('clean-window:site-access-cancel'); }
    finally { window.close(); }
  });

  async function init() {
    if (!token) throw new Error('缺少網站授權識別碼。');
    const result = await send('clean-window:site-access-info');
    if (!result?.ok) throw new Error(result?.error || '無法確認目標網站。');
    host.textContent = result.host;
    originPatterns = result.originPatterns;
    scopeNote.textContent = originPatterns.length > 1
      ? '你輸入的是 HTTP 網址；為了支援網站常見的自動升級，會同時請求此網域的 HTTP 與 HTTPS 存取。'
      : '只請求此網域的 HTTPS 存取；不會授權其他網域或子網域。';
    setEnabled(true);
  }
  init().catch(error => {
    host.textContent = '目標網站無法使用';
    setStatus(error?.message || String(error));
    setEnabled(false);
  });
})();
