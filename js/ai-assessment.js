// ===== BioMotion Lab – AI Assessment (Claude API) =====

const STORAGE_KEY = 'biomotion_claude_api_key';

export function getApiKey() { return localStorage.getItem(STORAGE_KEY) || ''; }
export function saveApiKey(key) { localStorage.setItem(STORAGE_KEY, key.trim()); }
export function clearApiKey() { localStorage.removeItem(STORAGE_KEY); }

// Prepare a compact summary payload for Claude
function preparePayload(session) {
  const meta    = session.metadata;
  const summary = session.summary;
  if (!summary) return null;

  const formatStats = (obj) => Object.entries(obj || {}).map(([k, v]) => ({
    angle: k,
    min:  v?.min?.toFixed(1),
    max:  v?.max?.toFixed(1),
    rom:  v?.range?.toFixed(1),
    mean: v?.mean?.toFixed(1),
  }));

  return {
    assessmentType: meta.assessmentType,
    viewMode: meta.viewMode,
    patientAge:    meta.patientAge    || 'unknown',
    patientGender: meta.patientGender || 'unknown',
    videoDuration: meta.videoDuration?.toFixed(1),
    sagittalAngles: formatStats(summary.sagittal),
    frontalAngles:  formatStats(summary.frontal),
    asymmetry: Object.entries(summary.asymmetry || {}).map(([k, v]) => ({
      joint: k,
      percent: v?.percent,
      label:   v?.label,
      dominant: v?.dominant,
    })).filter(a => a.percent !== undefined),
    movementQualityScore: summary.qualityScore?.total,
    scoreBreakdown: summary.qualityScore,
  };
}

const SYSTEM_PROMPT = `You are a biomechanics expert and physical therapist specialising in functional movement assessment. Analyse the following 2D video-based motion capture data and provide a thorough clinical assessment.

IMPORTANT CAVEATS:
- Data comes from markerless 2D pose estimation (TensorFlow MoveNet) with inherent measurement error of approximately 5–10 degrees.
- Frame your observations using language like "suggests", "may indicate", "consistent with" rather than definitive diagnoses.
- This is a screening and monitoring tool, not a diagnostic instrument. Always recommend clinical examination for findings of concern.

Structure your response EXACTLY as follows, using these exact section headers on their own lines:

## Movement Quality Summary
(2–3 sentence overall assessment of the movement quality and any standout findings)

## Joint-by-Joint Analysis
(For each joint: observed ROM, comparison to normative values, and any concerns noted. Use bullet points.)

## Compensatory Patterns
(Identify any movement compensations visible in the data — e.g., trunk lean to offload a hip, asymmetric loading patterns. Use bullet points.)

## Asymmetry Analysis
(Discuss the left–right differences. Note clinical significance of any asymmetries found. Use bullet points.)

## Risk Factors
(Flag any values suggesting elevated injury risk or movement dysfunction. Be specific. Use bullet points.)

## Recommendations
(3–5 specific, actionable clinical recommendations for the practitioner. Use numbered list.)

Use professional language accessible to both clinicians and patients. Be concise but thorough.`;

export async function runAIAssessment(session) {
  const key = getApiKey();
  if (!key) throw new Error('No API key configured. Please enter your Anthropic API key in the AI Analysis tab.');

  const payload = preparePayload(session);
  if (!payload) throw new Error('No analysis data available. Please analyse a video first.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Please analyse this functional movement assessment data:\n\n${JSON.stringify(payload, null, 2)}`,
      }],
    }),
  });

  if (!response.ok) {
    let msg = `API error ${response.status}`;
    try {
      const errBody = await response.json();
      msg = errBody.error?.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const result = await response.json();
  return result.content[0].text;
}

// Parse the structured markdown response into sections
export function parseAIResponse(text) {
  const sections = [];
  const headings = [
    { key: 'summary',      title: 'Movement Quality Summary',    header: '## Movement Quality Summary',    type: 'primary' },
    { key: 'joints',       title: 'Joint-by-Joint Analysis',     header: '## Joint-by-Joint Analysis',     type: 'info' },
    { key: 'compensation', title: 'Compensatory Patterns',       header: '## Compensatory Patterns',       type: 'warning' },
    { key: 'asymmetry',    title: 'Asymmetry Analysis',          header: '## Asymmetry Analysis',          type: 'warning' },
    { key: 'risk',         title: 'Risk Factors',                header: '## Risk Factors',                type: 'danger' },
    { key: 'recs',         title: 'Recommendations',             header: '## Recommendations',             type: 'success' },
  ];

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const nextH = headings[i + 1];
    const start = text.indexOf(h.header);
    if (start === -1) continue;
    const contentStart = start + h.header.length;
    const end = nextH ? text.indexOf(nextH.header) : text.length;
    const raw = text.slice(contentStart, end === -1 ? text.length : end).trim();
    sections.push({ key: h.key, title: h.title, content: raw, type: h.type });
  }

  // If parsing failed, return entire text as one section
  if (!sections.length) {
    sections.push({ key: 'full', title: 'AI Assessment', content: text, type: 'primary' });
  }
  return sections;
}

// Render parsed sections into the UI
export function renderAIResults(sections) {
  const container = document.getElementById('aiResults');
  if (!container) return;

  container.innerHTML = '';
  container.style.display = 'flex';

  for (const sec of sections) {
    const card = document.createElement('div');
    card.className = `ai-card ai-card--${sec.type}`;

    // Convert basic markdown to HTML
    const html = markdownToHtml(sec.content);
    card.innerHTML = `<div class="ai-card__title">${sec.title}</div><div class="ai-card__content">${html}</div>`;
    container.appendChild(card);
  }
}

function markdownToHtml(text) {
  return text
    .replace(/^## .+$/gm, '') // remove extra headers
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^(?!<)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[uo]l>)/g, '$1')
    .replace(/(<\/[uo]l>)<\/p>/g, '$1');
}
