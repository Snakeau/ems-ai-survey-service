const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const dataFileName = process.env.DATA_FILE_NAME || 'submissions.jsonl';
const dataFile = path.join(dataDir, dataFileName);
const resultsAccessKey = process.env.RESULTS_ACCESS_KEY || '';
const resultsPageFile = path.join(__dirname, 'private', 'results.html');

fs.mkdirSync(dataDir, { recursive: true });

function hasValidResultsKey(candidateKey) {
  if (!resultsAccessKey || typeof candidateKey !== 'string') {
    return false;
  }

  const expected = Buffer.from(resultsAccessKey, 'utf8');
  const provided = Buffer.from(candidateKey, 'utf8');

  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
}

function readSubmissions(callback) {
  fs.readFile(dataFile, 'utf8', (error, raw) => {
    if (error) {
      if (error.code === 'ENOENT') {
        return callback(null, []);
      }

      return callback(error);
    }

    const submissions = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return callback(null, submissions);
  });
}

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/results/:key', (req, res) => {
  if (!hasValidResultsKey(req.params.key)) {
    return res.status(404).send('Not found');
  }

  return res.sendFile(resultsPageFile);
});

app.get('/api/results/:key', (req, res) => {
  if (!hasValidResultsKey(req.params.key)) {
    return res.status(404).json({ error: 'Not found' });
  }

  return readSubmissions((error, submissions) => {
    if (error) {
      return res.status(500).json({ error: 'Could not read submissions' });
    }

    return res.json({
      totalSubmissions: submissions.length,
      lastSubmittedAt: submissions.length ? submissions[submissions.length - 1].submittedAt : null,
      submissions
    });
  });
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
  if (!resultsAccessKey) {
    console.warn('RESULTS_ACCESS_KEY is not set. Results page is disabled.');
  }

  console.log(`Survey service running on http://localhost:${port}`);
});
