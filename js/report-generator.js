// ===== BioMotion Lab – Report Generator =====
// Uses jsPDF (window.jspdf.jsPDF) + html2canvas

export async function generatePDFReport(session, chartImages, video) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) { alert('jsPDF not loaded'); return; }

  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, M = 15, CW = W - 2 * M;

  const meta    = session.metadata;
  const summary = session.summary;

  // ---- Page 1: Cover / Summary ----
  addPage1(doc, meta, summary, W, M, CW);

  // ---- Page 2: Key Frame Snapshots ----
  const snapshots = await captureSnapshots(video, session);
  if (snapshots.length) {
    doc.addPage();
    addSnapshotPage(doc, snapshots, M, CW);
  }

  // ---- Page 3: Charts ----
  if (Object.keys(chartImages).length) {
    doc.addPage();
    addChartPage(doc, chartImages, M, CW);
  }

  // ---- Page 4: Metrics Table ----
  if (summary) {
    doc.addPage();
    addMetricsTable(doc, summary, M, CW, meta);
  }

  // ---- Page 5: AI Assessment ----
  if (session.aiAssessment) {
    doc.addPage();
    addAIPage(doc, session.aiAssessment, M, CW);
  }

  const filename = `biomotion_${(meta.patientName || 'assessment').replace(/\s+/g, '_')}_${meta.assessmentDate}.pdf`;
  doc.save(filename);
}

// ---- Page builders ----

function addPage1(doc, meta, summary, W, M, CW) {
  let y = M;

  // Header bar
  doc.setFillColor(0, 180, 216);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BioMotion Lab', M, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Functional Movement Assessment Report', M, 22);

  y = 38;

  // Patient info block
  doc.setFillColor(240, 244, 248);
  doc.rect(M, y, CW, 22, 'F');
  doc.setTextColor(26, 32, 44);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const infoItems = [
    ['PATIENT',   meta.patientName    || '—'],
    ['AGE',       meta.patientAge     ? `${meta.patientAge} yrs` : '—'],
    ['GENDER',    meta.patientGender  || '—'],
    ['DATE',      meta.assessmentDate || '—'],
    ['ASSESSMENT',ucFirst(meta.assessmentType || 'Custom')],
    ['CLINICIAN', meta.clinician      || '—'],
  ];
  const colW = CW / infoItems.length;
  infoItems.forEach(([label, val], i) => {
    const x = M + i * colW + 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(160, 174, 192);
    doc.text(label, x, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(26, 32, 44);
    doc.text(val, x, y + 15);
  });

  y += 30;

  // Quality Score
  if (summary?.qualityScore) {
    const qs = summary.qualityScore;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(M, y, CW, 36, 4, 4, 'FD');

    const cx = W / 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(160, 174, 192);
    doc.text('MOVEMENT QUALITY SCORE', cx, y + 8, { align: 'center' });

    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 180, 216);
    doc.text(`${qs.total}`, cx, y + 24, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(160, 174, 192);
    doc.text(`ROM: ${qs.romScore}/40    Symmetry: ${qs.symScore}/30    Smoothness: ${qs.smoothScore}/30`, cx, y + 31, { align: 'center' });

    y += 44;
  }

  // Key Findings
  if (summary) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 32, 44);
    doc.text('Key Findings', M, y + 6);
    doc.setDrawColor(0, 180, 216);
    doc.setLineWidth(0.5);
    doc.line(M, y + 8, M + CW, y + 8);
    y += 12;

    const findings = buildKeyFindings(summary);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    for (const f of findings.slice(0, 8)) {
      if (y > 260) break;
      doc.setFillColor(0, 180, 216);
      doc.circle(M + 2, y + 0.5, 1, 'F');
      doc.setTextColor(74, 85, 104);
      doc.text(f, M + 6, y + 1.5);
      y += 7;
    }
  }

  // Footer
  addFooter(doc, 1);
}

function addSnapshotPage(doc, snapshots, M, CW) {
  addSectionHeader(doc, 'Key Movement Frames', M);
  let y = 38;
  const colW = (CW - 10) / 2;
  const imgH = colW * 0.65;

  snapshots.forEach((snap, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (colW + 10);
    const yy = y + row * (imgH + 14);
    if (snap.dataUrl) {
      try {
        doc.addImage(snap.dataUrl, 'JPEG', x, yy, colW, imgH);
      } catch (_) {}
    }
    doc.setFontSize(8);
    doc.setTextColor(74, 85, 104);
    doc.setFont('helvetica', 'bold');
    doc.text(snap.label, x + colW / 2, yy + imgH + 5, { align: 'center' });
  });

  addFooter(doc, doc.internal.getCurrentPageInfo().pageNumber);
}

function addChartPage(doc, chartImages, M, CW) {
  addSectionHeader(doc, 'Angle Time-Series Graphs', M);
  let y = 38;
  const keys = Object.keys(chartImages);
  const colW = (CW - 8) / 2;
  const imgH = 36;

  keys.forEach((key, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x  = M + col * (colW + 8);
    const yy = y + row * (imgH + 4);
    if (yy + imgH > 270) return;
    try {
      doc.addImage(chartImages[key], 'JPEG', x, yy, colW, imgH);
    } catch (_) {}
  });

  addFooter(doc, doc.internal.getCurrentPageInfo().pageNumber);
}

function addMetricsTable(doc, summary, M, CW, meta) {
  addSectionHeader(doc, 'Detailed Metrics', M);

  const headers = ['Joint', 'Side', 'Min (°)', 'Max (°)', 'ROM (°)', 'Mean (°)', 'Status'];
  const colWidths = [38, 18, 24, 24, 24, 24, 28];
  let y = 38;

  // Table header
  doc.setFillColor(27, 40, 56);
  doc.rect(M, y, CW, 8, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  let x = M + 2;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, y + 5);
    x += colWidths[i];
  }
  y += 8;

  // Data rows
  const rows = buildMetricsRows(summary);
  let rowIdx = 0;
  for (const row of rows) {
    if (y > 270) { doc.addPage(); addSectionHeader(doc, 'Detailed Metrics (cont.)', M); y = 38; }
    const bg = rowIdx++ % 2 === 0 ? [255,255,255] : [240,244,248];
    doc.setFillColor(...bg);
    doc.rect(M, y, CW, 7, 'F');

    const colors = { Normal: [72,187,120], Borderline: [236,201,75], Outside: [252,129,129], '—': [160,174,192] };

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(26, 32, 44);
    let rx = M + 2;
    row.forEach((cell, ci) => {
      if (ci === headers.length - 1) {
        const c = colors[cell] || [160,174,192];
        doc.setTextColor(...c);
        doc.setFont('helvetica', 'bold');
      }
      doc.text(String(cell ?? '—'), rx, y + 5);
      rx += colWidths[ci];
      doc.setTextColor(26, 32, 44);
      doc.setFont('helvetica', 'normal');
    });
    y += 7;
  }

  addFooter(doc, doc.internal.getCurrentPageInfo().pageNumber);
}

function addAIPage(doc, aiText, M, CW) {
  addSectionHeader(doc, 'AI Biomechanical Assessment', M);
  let y = 42;

  doc.setFontSize(8);
  doc.setTextColor(160, 174, 192);
  doc.setFont('helvetica', 'italic');
  doc.text('Generated by Claude AI. For informational purposes only — not a medical diagnosis.', M, y);
  y += 8;

  // Strip markdown, wrap text
  const plain = aiText
    .replace(/^##\s+/gm, '\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-•]\s+/gm, '  • ')
    .replace(/^(\d+)\.\s+/gm, '  $1. ');

  const lines = doc.splitTextToSize(plain, CW);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(26, 32, 44);

  for (const line of lines) {
    if (y > 272) { doc.addPage(); y = 20; }
    const isHeader = line.trim() && !line.startsWith('  ') && line.trim().length > 3 && !line.trim().startsWith('•');
    if (isHeader && line.trim().split(' ').length < 6) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 180, 216);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(26, 32, 44);
    }
    doc.text(line, M, y);
    y += 5.5;
  }

  addFooter(doc, doc.internal.getCurrentPageInfo().pageNumber);
}

// ---- Helpers ----

function addSectionHeader(doc, title, M) {
  doc.setFillColor(0, 180, 216);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, M, 14);
}

function addFooter(doc, pageNum) {
  const y = 287;
  doc.setFontSize(7);
  doc.setTextColor(160, 174, 192);
  doc.setFont('helvetica', 'normal');
  doc.text('BioMotion Lab – Functional Movement Assessment', 15, y);
  doc.text(`Page ${pageNum}`, 195, y, { align: 'right' });
  doc.text('For clinical screening purposes only. Not a substitute for medical assessment.', 105, y, { align: 'center' });
}

function ucFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s; }

function buildKeyFindings(summary) {
  const findings = [];
  const sag = summary.sagittal || {};
  const asym = summary.asymmetry || {};

  if (sag.leftKneeFlexion && sag.rightKneeFlexion) {
    const avg = ((sag.leftKneeFlexion.range || 0) + (sag.rightKneeFlexion.range || 0)) / 2;
    findings.push(`Knee flexion ROM: Left ${sag.leftKneeFlexion.range?.toFixed(1)}° / Right ${sag.rightKneeFlexion.range?.toFixed(1)}°`);
  }
  if (asym.knee) findings.push(`Knee asymmetry: ${asym.knee.percent}% (${asym.knee.label})`);
  if (asym.hip)  findings.push(`Hip asymmetry: ${asym.hip.percent}% (${asym.hip.label})`);
  if (sag.trunkInclination) findings.push(`Peak trunk inclination: ${sag.trunkInclination.max?.toFixed(1)}°`);

  const fro = summary.frontal || {};
  if (fro.trunkLateralFlexion) {
    const v = fro.trunkLateralFlexion.mean;
    if (v !== undefined) findings.push(`Trunk lateral lean: ${Math.abs(v).toFixed(1)}° to the ${v >= 0 ? 'right' : 'left'}`);
  }
  if (fro.pelvisTilt) {
    const v = fro.pelvisTilt.mean;
    if (v !== undefined && Math.abs(v) > 3) findings.push(`Pelvic tilt: ${Math.abs(v).toFixed(1)}° (${v >= 0 ? 'right' : 'left'} drop)`);
  }

  return findings.length ? findings : ['No significant findings recorded.'];
}

function buildMetricsRows(summary) {
  const rows = [];
  const planes = [
    { label: 'Sagittal', data: summary.sagittal },
    { label: 'Frontal',  data: summary.frontal },
  ];

  const labels = {
    leftKneeFlexion: 'Knee Flexion', rightKneeFlexion: 'Knee Flexion',
    leftHipFlexion: 'Hip Flexion', rightHipFlexion: 'Hip Flexion',
    leftElbowFlexion: 'Elbow Flexion', rightElbowFlexion: 'Elbow Flexion',
    leftShoulderFlexion: 'Shoulder Flexion', rightShoulderFlexion: 'Shoulder Flexion',
    trunkInclination: 'Trunk Inclination',
    leftKneeFPPA: 'Knee FPPA', rightKneeFPPA: 'Knee FPPA',
    leftShoulderAbduction: 'Shoulder Abduction', rightShoulderAbduction: 'Shoulder Abduction',
    trunkLateralFlexion: 'Trunk Lateral Flex',
    shoulderTilt: 'Shoulder Tilt',
    pelvisTilt: 'Pelvic Tilt',
  };

  for (const { data } of planes) {
    if (!data) continue;
    for (const [key, stats] of Object.entries(data)) {
      if (!stats) continue;
      const side = key.startsWith('left') ? 'Left' : key.startsWith('right') ? 'Right' : 'Both';
      rows.push([
        labels[key] || key,
        side,
        stats.min?.toFixed(1)  ?? '—',
        stats.max?.toFixed(1)  ?? '—',
        stats.range?.toFixed(1)?? '—',
        stats.mean?.toFixed(1) ?? '—',
        '—', // normative status would need age/gender context
      ]);
    }
  }
  return rows;
}

// Capture key frames from video
async function captureSnapshots(video, session) {
  if (!video.src || !session.frames.length) return [];

  const summary = session.summary;
  const snapshots = [];

  // Find interesting timestamps
  const times = [0]; // start
  if (summary?.sagittal) {
    const frames = session.frames;
    // Frame of max knee flexion
    const lkf = frames.map(f => f.angles?.sagittal?.leftKneeFlexion ?? 0);
    const maxLK = lkf.indexOf(Math.max(...lkf));
    if (maxLK >= 0) times.push(frames[maxLK].timestamp);

    // Frame of max hip flexion
    const lhf = frames.map(f => f.angles?.sagittal?.leftHipFlexion ?? 180);
    const minLH = lhf.indexOf(Math.min(...lhf));
    if (minLH >= 0 && frames[minLH]) times.push(frames[minLH].timestamp);
  }
  times.push(video.duration * 0.5); // midpoint
  if (times.length < 4) times.push(video.duration * 0.9);

  const uniqueTimes = [...new Set(times.filter(t => t >= 0 && t <= video.duration))].slice(0, 4);
  const labels = ['Start', 'Peak Knee Flexion', 'Peak Hip Flexion', 'Mid Point', 'End'];

  for (let i = 0; i < uniqueTimes.length; i++) {
    const t = uniqueTimes[i];
    try {
      const dataUrl = await captureFrame(video, t);
      snapshots.push({ dataUrl, label: labels[i] || `t=${t.toFixed(2)}s`, timestamp: t });
    } catch (_) {}
  }
  return snapshots;
}

function captureFrame(video, timestamp) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      resolve(c.toDataURL('image/jpeg', 0.80));
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = timestamp;
    setTimeout(() => reject(new Error('timeout')), 3000);
  });
}

// Build in-browser report preview
export function buildReportPreview(session) {
  const container = document.getElementById('reportPreviewContent');
  if (!container || !session.summary) return;

  const meta = session.metadata;
  const summary = session.summary;
  const qs = summary.qualityScore;

  container.innerHTML = `
    <div class="report-section">
      <div class="report-section__title">Movement Quality</div>
      ${qs ? `
      <div style="text-align:center; padding: 20px;">
        <div class="report-score">
          <div class="report-score__circle">
            <span class="report-score__number">${qs.total}</span>
          </div>
          <div class="report-score__label">Overall Quality Score</div>
          <div style="display:flex; justify-content:center; gap:32px; margin-top:16px;">
            <div><strong>${qs.romScore}/40</strong><br/><small>ROM</small></div>
            <div><strong>${qs.symScore}/30</strong><br/><small>Symmetry</small></div>
            <div><strong>${qs.smoothScore}/30</strong><br/><small>Smoothness</small></div>
          </div>
        </div>
      </div>` : '<p style="color:var(--text-muted);">Score not available</p>'}
    </div>

    <div class="report-section">
      <div class="report-section__title">Metrics Summary</div>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Joint</th><th>Side</th><th>Min</th><th>Max</th><th>ROM</th><th>Mean</th>
          </tr>
        </thead>
        <tbody>
          ${buildMetricsTableHTML(summary)}
        </tbody>
      </table>
    </div>

    <div class="report-section">
      <div class="report-section__title">Asymmetry Analysis</div>
      ${buildAsymmetryHTML(summary)}
    </div>
  `;
}

function buildMetricsTableHTML(summary) {
  const rows = buildMetricsRows(summary);
  return rows.map(r => `
    <tr>
      <td>${r[0]}</td><td>${r[1]}</td>
      <td class="value">${r[2]}</td><td class="value">${r[3]}</td>
      <td class="value">${r[4]}</td><td class="value">${r[5]}</td>
    </tr>`).join('');
}

function buildAsymmetryHTML(summary) {
  const asym = summary.asymmetry || {};
  const labels = { knee: 'Knee Flexion', hip: 'Hip Flexion', elbow: 'Elbow Flexion', shoulder: 'Shoulder Flexion', kneeFPPA: 'Knee FPPA' };
  const rows = Object.entries(asym).filter(([,v]) => v).map(([k, v]) => `
    <div class="asymmetry-row">
      <span class="asymmetry-row__label">${labels[k] || k}</span>
      <span class="asymmetry-row__value ${v.cssClass}">${v.percent}% – ${v.label}</span>
    </div>`).join('');
  return rows || '<p style="color:var(--text-muted);">No data</p>';
}
