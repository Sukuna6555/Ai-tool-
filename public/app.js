(() => {
  const messagesEl = document.getElementById('messages');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('input');
  const fileInput = document.getElementById('file-input');

  function appendMessage(text, cls = 'assistant', meta) {
    const el = document.createElement('div');
    el.className = `message ${cls}`;
    if (meta) {
      const m = document.createElement('div');
      m.className = 'meta';
      m.textContent = meta;
      el.appendChild(m);
    }
    const p = document.createElement('p');
    p.textContent = text || '';
    el.appendChild(p);
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return p;
  }

  function appendImage(url, cls='assistant'){
    const el = document.createElement('div');
    el.className = `message ${cls}`;
    const img = document.createElement('img');
    img.src = url;
    el.appendChild(img);
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function uploadFile(file){
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload failed');
    const j = await res.json();
    return j.url;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    const file = fileInput.files[0];
    let imagePath = null;

    if (!text && !file) return;

    // show user message
    if (text) appendMessage(text, 'user', 'You');
    if (file) {
      appendMessage(file.name, 'user', 'You (image)');
    }

    input.value = '';
    fileInput.value = '';

    try {
      if (file) {
        imagePath = await uploadFile(file);
        // show preview
        appendImage(imagePath, 'user');
      }

      // Prepare payload
      const payload = { message: text, image: imagePath };

      // Add assistant placeholder
      const assistantP = appendMessage('', 'assistant', 'Assistant');

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const err = await resp.json().catch(()=>({error:'Unknown'}));
        assistantP.textContent = 'Error: ' + (err.error || 'Request failed');
        return;
      }

      // stream text
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          assistantP.textContent += chunk;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      }

    } catch (err) {
      console.error(err);
      appendMessage('Error: ' + err.message, 'assistant');
    }
  });

  // allow Enter to send
  input.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
})();
