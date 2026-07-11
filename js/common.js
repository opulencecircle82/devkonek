// Shared helpers — requires config.js and the Supabase CDN script loaded first.
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Redirects to auth.html if not logged in; returns { user, profile }.
// If the logged-in user's role doesn't match requiredRole, sends them to their own dashboard.
async function requireAuth(requiredRole) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return null;
  }
  const { data: profile, error } = await db
    .from('profiles').select('*').eq('id', user.id).single();
  if (error || !profile) {
    window.location.href = 'auth.html';
    return null;
  }
  if (profile.is_banned) {
    await db.auth.signOut();
    window.location.href = 'auth.html?banned=1';
    return null;
  }
  if (requiredRole && profile.role !== requiredRole) {
    window.location.href = profile.role === 'client' ? 'client.html' : 'dev.html';
    return null;
  }
  return { user, profile };
}

async function logout() {
  await db.auth.signOut();
  window.location.href = 'index.html';
}

// Redirects to auth.html if not logged in, or to index.html if the logged-in
// user is not flagged as an admin (profiles.is_admin — set via SQL, never
// trust anything client-side for this check; RLS enforces it server-side too).
async function requireAdmin() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    window.location.href = 'auth.html';
    return null;
  }
  const { data: profile, error } = await db
    .from('profiles').select('*').eq('id', user.id).single();
  if (error || !profile || !profile.is_admin) {
    window.location.href = 'index.html';
    return null;
  }
  return { user, profile };
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function peso(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH');
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Renders "★★★★☆ 4.2 (12)" — or "No reviews yet" if count is 0.
function renderStars(avg, count) {
  if (!count) return '<span style="color:var(--muted);font-size:13px">No reviews yet</span>';
  const rounded = Math.round(avg);
  const full = '★'.repeat(rounded);
  const empty = '☆'.repeat(5 - rounded);
  return '<span style="color:#f59e0b;letter-spacing:1px">' + full + empty + '</span> ' +
    '<span style="font-size:13px;color:var(--muted)">' + avg.toFixed(1) + ' (' + count + ')</span>';
}

// Builds a Map<profileId, {avg, count}> from a list of review rows (each with reviewee_id + rating).
function aggregateRatings(reviews) {
  const byUser = new Map();
  (reviews || []).forEach(r => {
    const entry = byUser.get(r.reviewee_id) || { sum: 0, count: 0 };
    entry.sum += r.rating;
    entry.count += 1;
    byUser.set(r.reviewee_id, entry);
  });
  const result = new Map();
  byUser.forEach((v, k) => result.set(k, { avg: v.sum / v.count, count: v.count }));
  return result;
}

// Interactive 1-5 star picker. Returns the container element; call .getValue() to read the selection.
function buildStarPicker(containerId, initialValue) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  el.style.cssText = 'font-size:28px;cursor:pointer;letter-spacing:4px;color:#d1d5db';
  let value = initialValue || 0;
  const spans = [];
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement('span');
    s.textContent = '★';
    s.dataset.val = i;
    s.addEventListener('click', () => { value = i; render(); });
    el.appendChild(s);
    spans.push(s);
  }
  function render() {
    spans.forEach((s, idx) => { s.style.color = idx < value ? '#f59e0b' : '#d1d5db'; });
  }
  render();
  el.getValue = () => value;
  return el;
}

function statusBadge(status) {
  const labels = {
    open: 'Open', in_progress: 'In Progress', completed: 'Completed',
    cancelled: 'Cancelled', pending: 'Pending', accepted: 'Accepted', declined: 'Declined'
  };
  return '<span class="badge badge-' + status + '">' + (labels[status] || status) + '</span>';
}

const PROJECT_TYPES = { website: 'Website', mobile_app: 'Mobile App', both: 'Website + Mobile App' };

const CATEGORIES = [
  'E-commerce / Online Store', 'POS System', 'Booking / Reservation',
  'Food Delivery', 'Portfolio / Company Website', 'Inventory Management',
  'Landing Page', 'School / LMS', 'Other'
];

const SKILL_OPTIONS = [
  'HTML/CSS/JS', 'React', 'Vue', 'Angular', 'Node.js', 'PHP/Laravel',
  'Python/Django', 'Flutter', 'React Native', 'Android (Kotlin/Java)',
  'iOS (Swift)', 'WordPress', 'Shopify', 'UI/UX Design', 'Database/SQL',
  'Supabase/Firebase'
];

// Suggested price ranges shown to clients when posting (PHP)
const BUDGET_PRESETS = [
  { label: 'Landing Page — ₱3,000 to ₱8,000', min: 3000, max: 8000 },
  { label: 'Company Website — ₱8,000 to ₱25,000', min: 8000, max: 25000 },
  { label: 'E-commerce Website — ₱15,000 to ₱60,000', min: 15000, max: 60000 },
  { label: 'Mobile App (simple) — ₱20,000 to ₱80,000', min: 20000, max: 80000 },
  { label: 'Mobile App (complex) — ₱80,000 to ₱300,000', min: 80000, max: 300000 },
  { label: 'Custom / I will type my own budget', min: 0, max: 0 }
];

const REPORT_REASONS = [
  'Did not pay after project completion',
  'Unresponsive / disappeared mid-project',
  'Scam / fake project or fake business',
  'Delivered nothing / abandoned the work',
  'Harassment or abusive behavior',
  'Other'
];

// Builds a reusable "Report this user" form block (reason select + details + submit),
// hidden by default under a toggle button. Call after inserting the returned HTML into the DOM
// to attach the submit handler.
function reportFormHtml(formId, projectId, reportedId, reportedName) {
  const options = REPORT_REASONS.map(r => '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>').join('');
  return (
    '<div style="margin-top:8px">' +
    '<button type="button" class="btn btn-outline btn-sm" onclick="toggleReportForm(\'' + formId + '\')">Report ' + escapeHtml(reportedName) + '</button>' +
    '<div id="report-form-' + formId + '" style="display:none;margin-top:8px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px">' +
    '<label style="margin-top:0">Reason</label>' +
    '<select id="report-reason-' + formId + '">' + options + '</select>' +
    '<label>Details (optional)</label>' +
    '<textarea id="report-details-' + formId + '" placeholder="What happened?"></textarea>' +
    '<button type="button" class="btn btn-danger btn-sm" style="margin-top:8px" ' +
    'onclick="submitReport(\'' + projectId + '\',\'' + reportedId + '\',\'' + formId + '\')">Submit Report</button>' +
    '<div class="error-msg" id="report-err-' + formId + '"></div>' +
    '<div class="success-msg" id="report-ok-' + formId + '" style="display:none">Report submitted. Our admins will review it.</div>' +
    '</div></div>'
  );
}

function toggleReportForm(formId) {
  const el = document.getElementById('report-form-' + formId);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function submitReport(projectId, reportedId, formId) {
  const errEl = document.getElementById('report-err-' + formId);
  const okEl = document.getElementById('report-ok-' + formId);
  errEl.textContent = '';
  const reason = document.getElementById('report-reason-' + formId).value;
  const details = document.getElementById('report-details-' + formId).value.trim();

  const { data: { user } } = await db.auth.getUser();
  const { error } = await db.from('reports').insert({
    project_id: projectId,
    reporter_id: user.id,
    reported_id: reportedId,
    reason: reason,
    details: details
  });
  if (error) { errEl.textContent = error.message; return; }
  document.getElementById('report-form-' + formId).querySelectorAll('select, textarea, button').forEach(el => el.disabled = true);
  okEl.style.display = 'block';
}
