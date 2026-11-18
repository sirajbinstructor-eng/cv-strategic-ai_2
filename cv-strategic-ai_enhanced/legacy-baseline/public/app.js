
'use strict';

const $ = id => document.getElementById(id);

const state = {
  analysis: null,
  source: null,
  mode: 'automatic',
  busy: false
};

function setVisible(id, visible) {
  const element = $(id);
  if (!element) return;

  element.hidden = !visible;
  element.classList.toggle('hidden', !visible);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function showToast(message, type = 'info') {
  const toast = $('toast');

  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.className = `toast ${type}`;
  setVisible('toast', true);

  window.clearTimeout(showToast.timer);

  showToast.timer = window.setTimeout(() => {
    setVisible('toast', false);
  }, 4500);
}

function showLogin(message = '') {
  setVisible('loginPanel', true);
  setVisible('appPanel', false);
  setVisible('logoutBtn', false);

  if (message && $('loginError')) {
    $('loginError').textContent = message;
  }
}

function showApplication() {
  setVisible('loginPanel', false);
  setVisible('appPanel', true);
  setVisible('logoutBtn', true);
}

function getMode() {
  return document.querySelector('input[name="mode"]:checked')?.value
    || 'automatic';
}

function setBusy(busy) {
  state.busy = busy;

  const analyzeButton = $('analysisForm')?.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  if (analyzeButton) analyzeButton.disabled = busy;
  if ($('refineBtn')) $('refineBtn').disabled = busy;
  if ($('generateBtn')) $('generateBtn').disabled = busy;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options
  });

  if (response.status === 401) {
    showLogin('Your session has expired. Please sign in again.');
    throw new Error('Session expired.');
  }

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;

    if (contentType.includes('application/json')) {
      const data = await response.json();
      message = data.error || message;
    }

    throw new Error(message);
  }

  return contentType.includes('application/json')
    ? response.json()
    : response;
}

/* =========================================================
   SESSION
========================================================= */

async function checkSession() {
  try {
    const data = await api('/api/session');

    if (data.authenticated) {
      showApplication();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('[SESSION]', error);
    showLogin('Unable to verify your session. Please sign in again.');
  }
}

/* =========================================================
   LOGIN / LOGOUT
========================================================= */

$('loginForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  const password = $('password')?.value || '';

  if ($('loginError')) {
    $('loginError').textContent = '';
  }

  try {
    await api('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    if ($('password')) $('password').value = '';

    showApplication();
    showToast('Welcome back.', 'success');

  } catch (error) {
    showLogin(error.message);
  }
});

$('logoutBtn')?.addEventListener('click', async () => {
  try {
    await api('/api/logout', {
      method: 'POST'
    });

    state.analysis = null;
    state.source = null;

    showLogin();
    showToast('You have signed out.', 'success');

  } catch (error) {
    showToast(error.message, 'error');
  }
});

/* =========================================================
   MODE
========================================================= */

document.querySelectorAll('input[name="mode"]').forEach(input => {
  input.addEventListener('change', () => {
    state.mode = getMode();
    updateMode();
  });
});

function updateMode() {
  const consultant = state.mode === 'consultant';

  setVisible('consultantPanel', consultant && !!state.analysis);

  if (consultant && state.analysis) {
    renderConsultantAdvice(state.analysis);
  }
}

/* =========================================================
   SCORE
========================================================= */

function normalizeScore(value) {
  if (value === null || value === undefined || value === '') return null;
  let score = Number(value);
  if (!Number.isFinite(score)) return null;
  if (score >= 0 && score <= 1) score *= 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function renderScore(match = {}) {
  const score = normalizeScore(match.score);
  const breakdown = match.breakdown && typeof match.breakdown === 'object'
    ? match.breakdown : {};

  const categories = [
    ['mandatoryRequirements', 'Mandatory requirements'],
    ['responsibilities', 'Responsibilities'],
    ['technicalSkills', 'Technical skills'],
    ['toolsMethods', 'Tools and methods'],
    ['seniorityLeadership', 'Seniority and leadership']
  ];

  const rows = categories.map(([key, label]) => {
    const item = breakdown[key] || {};
    const value = normalizeScore(item.score);
    if (value === null) {
      return `
        <div class="score-breakdown-row score-unavailable">
          <span>${escapeHtml(label)}</span>
          <strong>Not assessed</strong>
        </div>
      `;
    }
    return `
      <div class="score-breakdown-row">
        <div class="score-breakdown-copy">
          <span>${escapeHtml(label)}</span>
          ${item.explanation
            ? `<small>${escapeHtml(item.explanation)}</small>`
            : ''}
        </div>
        <strong>${value}%</strong>
      </div>
    `;
  }).join('');

  return `
    <section class="match-section">
      <div class="score-circle">
        <strong>${score === null ? '—' : `${score}%`}</strong>
        <span>Estimated match</span>
      </div>

      <div class="score-copy">
        <h3>Estimated role relevance</h3>
        <p>${escapeHtml(
          match.explanation ||
          'Evidence-based estimate using the supplied CV and job description.'
        )}</p>
      </div>

      <div class="score-breakdown">
        <h4>Score breakdown</h4>
        ${rows}
      </div>

      <p class="score-disclaimer">
        This is an indicative estimate, not an actual ATS score or a hiring probability.
      </p>
    </section>
  `;
}

/* =========================================================
   GENERAL CONTENT
========================================================= */

function renderList(items, emptyMessage = 'No items identified.') {
  const values = Array.isArray(items) ? items : [];

  if (!values.length) {
    return `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`;
  }

  return `
    <ul class="advice-list">
      ${values.map(item => {
        const value = typeof item === 'string'
          ? item
          : item?.item || JSON.stringify(item);

        return `<li>${escapeHtml(value)}</li>`;
      }).join('')}
    </ul>
  `;
}

function renderSection(title, content, extraClass = '') {
  return `
    <section class="result-section ${extraClass}">
      <h3>${escapeHtml(title)}</h3>
      ${content}
    </section>
  `;
}

function renderEvidence(items) {
  const values = Array.isArray(items) ? items : [];
  const labels = {
    verified: 'Verified in CV',
    met: 'Verified in CV',
    partial: 'Partially supported',
    needs_confirmation: 'Needs confirmation',
    not_found: 'Not found in CV'
  };

  if (!values.length) {
    return renderSection(
      'Requirement evidence',
      '<p class="empty-state">No traceable evidence items were returned. Review the source CV before relying on the assessment.</p>'
    );
  }

  return renderSection(
    'Requirement evidence',
    `
      <div class="evidence-list">
        ${values.map(item => {
          const status = labels[item.status] ? item.status : 'needs_confirmation';
          return `
            <article class="evidence-item">
              <div class="evidence-heading">
                <strong>${escapeHtml(item.requirement || 'Requirement')}</strong>
                <span class="evidence-status status-${escapeHtml(status)}">
                  ${escapeHtml(labels[status])}
                </span>
              </div>
              ${item.evidence
                ? `<p>${escapeHtml(item.evidence)}</p>`
                : '<p class="evidence-missing">No supporting CV extract was provided.</p>'}
              ${item.reason
                ? `<small>${escapeHtml(item.reason)}</small>`
                : ''}
            </article>
          `;
        }).join('')}
      </div>
    `
  );
}

function renderExperiences(experiences) {
  if (!Array.isArray(experiences) || !experiences.length) {
    return '';
  }

  return renderSection(
    'Experience assessment',
    experiences.map(exp => `
      <article class="experience-item">
        <div class="experience-heading">
          <strong>${escapeHtml(exp.role || 'Role')}</strong>
          <span class="experience-action">
            ${escapeHtml(exp.action || 'Keep')}
          </span>
        </div>

        <p class="experience-meta">
          ${escapeHtml(exp.employer || '')}
          ${exp.dates ? ` · ${escapeHtml(exp.dates)}` : ''}
        </p>

        ${exp.reason
          ? `<p>${escapeHtml(exp.reason)}</p>`
          : ''}

        ${renderList(exp.bullets || [], '')}
      </article>
    `).join('')
  );
}

/* =========================================================
   CONSULTANT ADVICE
========================================================= */

function renderConsultantAdvice(analysis) {
  const questions = Array.isArray(analysis.questions)
    ? analysis.questions.slice(0, 2)
    : [];

  const tips = Array.isArray(analysis.tips)
    ? analysis.tips
    : [];

  const cautions = Array.isArray(analysis.cautions)
    ? analysis.cautions
    : [];

  const openLoops = Array.isArray(analysis.openLoops)
    ? analysis.openLoops
    : [];

  const questionList = $('questionList');

  if (questionList) {
    questionList.innerHTML = renderList(
      questions,
      'No essential clarification questions identified.'
    );
  }

  const advice = $('consultantAdvice');

  if (advice) {
    advice.innerHTML = `
      ${renderSection(
        'Consultant tips',
        renderList(tips, 'No additional recommendations identified.')
      )}

      ${renderSection(
        'Consultant cautions',
        renderList(cautions, 'No specific cautions identified.')
      )}

      ${openLoops.length
        ? renderSection('Open points', renderList(openLoops))
        : ''}
    `;
  }
}

/* =========================================================
   MAIN ANALYSIS
========================================================= */

function renderAnalysis(analysis, source = {}) {
  state.analysis = analysis;
  state.source = source;

  const content = $('analysisContent');

  if (!content) {
    console.error('Missing #analysisContent in index.html.');
    return;
  }

  const job = analysis.jobAnalysis || {};

  const skills = (Array.isArray(analysis.skills) ? analysis.skills : []).map(skill => {
    const status = skill.status
      ? ` · ${skill.status.replaceAll('_', ' ')}`
      : '';

    return `${skill.name || ''}${status}${skill.evidence ? ` — ${skill.evidence}` : ''}`;
  });

  content.innerHTML = `
    <header class="analysis-header">
      <p class="eyebrow">TARGET POSITION</p>
      <h2>${escapeHtml(analysis.targetTitle || 'Target role')}</h2>
      ${analysis.candidateHeadline
        ? `<p class="candidate-headline">${escapeHtml(analysis.candidateHeadline)}</p>`
        : ''}
      ${analysis.professionalSummary
        ? `<p class="professional-summary">${escapeHtml(analysis.professionalSummary)}</p>`
        : ''}
    </header>

    ${renderScore(analysis.match)}

    ${renderSection(
      'Mandatory requirements',
      renderList(job.mandatorySkills)
    )}

    ${renderSection(
      'Desirable skills and keywords',
      renderList([
        ...(job.desirableSkills || []),
        ...(job.keywords || [])
      ])
    )}

    ${renderSection(
      'Key strengths',
      renderList(analysis.strengths)
    )}

    ${renderSection(
      'Identified gaps',
      renderList(
        (analysis.gaps || []).map(gap =>
          typeof gap === 'string'
            ? gap
            : `${gap.item || ''}${gap.question ? ` — ${gap.question}` : ''}`
        ),
        'No significant gaps identified.'
      )
    )}

    ${renderEvidence(analysis.match?.evidenceItems)}

    ${renderExperiences(analysis.experiences)}

    ${renderSection(
      'Skills and evidence',
      renderList(skills)
    )}

    <p class="source-note">
      Source: ${escapeHtml(source.filename || '')}
      · ${Number(source.extractedCharacters || 0).toLocaleString()} extracted characters
    </p>
  `;

  setVisible('resultsPanel', true);
  setVisible('consultantPanel', state.mode === 'consultant');
  setVisible('generatePanel', true);

  renderConsultantAdvice(analysis);

  if ($('candidateName') && !$('candidateName').value) {
    $('candidateName').value = analysis.candidateName || '';
  }

  if ($('contact') && !$('contact').value) {
    const details = source.contactDetails || analysis.contactDetails || {};

    $('contact').value = [
      details.email,
      details.phone,
      details.linkedin,
      details.website
    ].filter(Boolean).join(' | ');
  }

  updateMode();
}

/* =========================================================
   ANALYZE FORM
========================================================= */

$('analysisForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  const file = $('cvFile')?.files?.[0];
  const jd = $('jobDescription')?.value?.trim();

  if (!file) {
    showToast('Please select your CV file.', 'error');
    return;
  }

  if (!jd || jd.length < 80) {
    showToast('Please provide a more complete job description.', 'error');
    return;
  }

  const formData = new FormData();

  formData.append('cv', file);
  formData.append('jobDescription', jd);
  formData.append('mode', getMode());

  state.mode = getMode();

  setBusy(true);
  setVisible('resultsPanel', false);
  setVisible('loadingState', true);
  setVisible('emptyState', false);
  setVisible('generatePanel', false);

  try {
    const data = await api('/api/analyze', {
      method: 'POST',
      body: formData
    });

    renderAnalysis(data.analysis, data.source || {});

    if ($('cacheMessage')) {
      $('cacheMessage').textContent = data.cacheHit
        ? 'The same CV and job description were retrieved from the current assessment cache.'
        : 'A new evidence-based assessment was completed.';

      setVisible('cacheMessage', true);
    }

    showToast('Analysis completed successfully.', 'success');

  } catch (error) {
    showToast(error.message, 'error');

    setVisible('emptyState', true);

  } finally {
    setVisible('loadingState', false);
    setBusy(false);
  }
});

/* =========================================================
   CONSULTANT REFINEMENT
========================================================= */

$('refineBtn')?.addEventListener('click', async () => {
  const answers = $('consultantAnswers')?.value?.trim();

  if (!answers) {
    showToast('Please enter your answers or corrections.', 'error');
    return;
  }

  setBusy(true);

  try {
    const data = await api('/api/refine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ answers })
    });

    renderAnalysis(data.analysis, state.source || {});

    if ($('consultantAnswers')) {
      $('consultantAnswers').value = '';
    }

    showToast('Consultant analysis updated.', 'success');

  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setBusy(false);
  }
});

/* =========================================================
   GENERATE DOCX
========================================================= */

$('generateBtn')?.addEventListener('click', async () => {
  if (!state.analysis) {
    showToast('Analyze a CV before generating it.', 'error');
    return;
  }

  setBusy(true);

  if ($('generateStatus')) {
    $('generateStatus').textContent = 'Generating your targeted CV...';
  }

  try {
    const response = await api('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        candidateName: $('candidateName')?.value?.trim() || '',
        contact: $('contact')?.value?.trim() || '',
        confirmedFacts: $('confirmedFacts')?.value?.trim() || ''
      })
    });

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'CV_Targeted.docx';

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    if ($('generateStatus')) {
      $('generateStatus').textContent = 'Your CV has been generated.';
    }

    showToast('Targeted CV generated.', 'success');

  } catch (error) {
    if ($('generateStatus')) {
      $('generateStatus').textContent = error.message;
    }

    showToast(error.message, 'error');

  } finally {
    setBusy(false);
  }
});

/* =========================================================
   FILE INPUT / DRAG AND DROP
========================================================= */

$('cvFile')?.addEventListener('change', () => {
  const file = $('cvFile').files?.[0];

  if ($('fileName')) {
    $('fileName').textContent = file
      ? file.name
      : 'No file selected';
  }
});

const uploadZone = $('uploadZone');

if (uploadZone && $('cvFile')) {
  ['dragenter', 'dragover'].forEach(name => {
    uploadZone.addEventListener(name, event => {
      event.preventDefault();
      uploadZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    uploadZone.addEventListener(name, event => {
      event.preventDefault();
      uploadZone.classList.remove('drag-over');
    });
  });

  uploadZone.addEventListener('drop', event => {
    const file = event.dataTransfer?.files?.[0];

    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();

    if (!['docx', 'pdf'].includes(extension)) {
      showToast('Only DOCX and PDF files are supported.', 'error');
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);

    $('cvFile').files = transfer.files;
    $('cvFile').dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/* =========================================================
   STARTUP
========================================================= */

(function initialize() {
  state.mode = getMode();

  // Always establish a visible initial state.
  // The asynchronous session check will then choose the right panel.
  showLogin();

  setVisible('resultsPanel', false);
  setVisible('consultantPanel', false);
  setVisible('generatePanel', false);
  setVisible('loadingState', false);
  setVisible('emptyState', true);

  checkSession();
})();