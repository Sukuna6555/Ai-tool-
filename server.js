const express = require('express');
const fetch = require('node-fetch');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health
app.get('/_health', (req, res) => res.json({ status: 'ok' }));

// Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// Chat endpoint with streaming
app.post('/api/chat', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set in environment' });

    const { message, image } = req.body || {};
    if (!message && !image) return res.status(400).json({ error: 'Message or image required' });

    const hostUrl = req.protocol + '://' + req.get('host');
    let userContent = message || '';
    if (image) {
      // image is a relative path such as /uploads/xxxxx
      userContent += `\n[Image]: ${hostUrl}${image}`;
    }

    // call OpenAI chat completions with streaming
    const payload = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: userContent }
      ],
      temperature: 0.7,
      stream: true
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error', errText);
      return res.status(500).json({ error: 'OpenAI API error', details: errText });
    }

    // Stream parsing: read server-sent event chunks from OpenAI and forward only the assistant text delta to the client as a plain text stream
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // OpenAI streams data in SSE chunks separated by "\n\n"
      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        const lines = part.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed === 'data: [DONE]') {
            // finish
            res.write('\n');
            res.end();
            return;
          }
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.replace(/^data:\s*/, '');
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
              const text = delta && delta.content;
              if (text) {
                res.write(text);
              }
            } catch (err) {
              // ignore JSON parse errors
            }
          }
        }
      }
    }

    // flush any remaining buffered data
    if (buffer) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
            const text = delta && delta.content;
            if (text) res.write(text);
          } catch (err) {}
        }
      }
    }

    res.end();

  } catch (err) {
    console.error('Server error', err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    else res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
