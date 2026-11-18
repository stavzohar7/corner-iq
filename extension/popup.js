const $ = id => document.getElementById(id);
const show = s => { $('st').textContent = s || ''; };
chrome.storage.local.get(['token', 'status'], r => { if (r.token) $('tok').placeholder = 'נשמר (' + r.token.slice(0, 8) + '...)'; show(r.status); });
chrome.storage.onChanged.addListener((c) => { if (c.status) show(c.status.newValue); });
$('save').onclick = () => { const v = $('tok').value.trim(); if (v) chrome.storage.local.set({ token: v }, () => show('המפתח נשמר')); };
$('run').onclick = () => { chrome.runtime.sendMessage({ cmd: 'run' }); show('התחיל. אפשר לסגור את החלון הזה.'); };
