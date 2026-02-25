const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const dataFileName = process.env.DATA_FILE_NAME || 'submissions.jsonl';
const dataFile = path.join(dataDir, dataFileName);

fs.mkdirSync(dataDir, { recursive: true });

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/submit', (req, res) => {
  const answers = req.body?.answers;

  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Invalid payload. Expected { answers: {...} }' });
  }

  const record = {
    submissionId: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    answers
  };

  fs.appendFile(dataFile, JSON.stringify(record) + '\n', 'utf8', (error) => {
    if (error) {
      return res.status(500).json({ error: 'Could not save submission' });
    }

    return res.status(201).json({ ok: true, submissionId: record.submissionId });
  });
});

app.listen(port, () => {
  console.log(`Survey service running on http://localhost:${port}`);
});
