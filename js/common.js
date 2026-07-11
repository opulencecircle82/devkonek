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
    if (error) console.error('requireAuth: profile fetch failed —', error.message, error);
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
    cancelled: 'Cancelled', pending: 'Pending', accepted: 'Accepted', declined: 'Declined',
    unpaid: 'Fee Unpaid', paid: 'Fee Paid', waived: 'Fee Waived',
    reviewed: 'Reviewed', dismissed: 'Dismissed'
  };
  return '<span class="badge badge-' + status + '">' + (labels[status] || status) + '</span>';
}

const PROJECT_TYPES = { website: 'Website', mobile_app: 'Mobile App', both: 'Website + Mobile App' };

const CATEGORIES = [
  'E-commerce / Online Store', 'POS System', 'Booking / Reservation',
  'Food Delivery', 'Portfolio / Company Website', 'Inventory Management',
  'Landing Page', 'School / LMS', 'Other'
];

// Quick-add suggestion chips shown under "Add What You Want" — clicking one adds it
// straight to the client's wants list. Not a required checklist, just ideas so
// non-technical clients don't have to think of everything from scratch.
const CATEGORY_SUGGESTIONS = {
  'E-commerce / Online Store': [
    { label: 'Online payment (GCash, Card, atbp.)', desc: 'Direktang babayaran ka ng customer sa app/website — hindi na COD/manual lang.' },
    { label: 'Account/login ng bawat customer', desc: 'Makikita nila ang sarili nilang order history kapag bumalik sila.' },
    { label: 'Admin panel', desc: 'Puwede mong kontrolin at tingnan ang lahat ng users, order, at produkto mo, hindi kailangan mag-code.' },
    { label: 'Secure na database', desc: 'Ligtas ang datos ng customer gamit ang trusted na 3rd-party na database tulad ng Supabase.' },
    { label: 'Makikitang stock ng mga paninda', desc: 'Makikita mo at ng customer kung ilan pa ang natitirang paninda.' },
    { label: 'Search at filter ng produkto', desc: 'Puwedeng maghanap ang customer ng specific na item.' },
    { label: 'SMS/Email updates sa customer', desc: 'Awtomatikong abiso kapag na-confirm o na-deliver na ang order.' },
    { label: 'Tracking ng delivery/rider', desc: 'Makikita ng customer kung saan na ang delivery/rider niya.' }
  ],
  'POS System': [
    { label: 'Kaya mag-print ng resibo', desc: 'Direktang puwedeng i-print ang resibo sa printer mo.' },
    { label: 'Stock/inventory tracking', desc: 'Awtomatikong babawasan ang stock count kada benta.' },
    { label: 'Maraming cashier/staff account', desc: 'Bawat empleyado may sariling login.' },
    { label: 'Admin panel', desc: 'Puwede mong kontrolin at tingnan ang lahat ng staff, benta, at produkto mo.' },
    { label: 'Secure na database', desc: 'Ligtas ang datos ng benta/staff mo gamit ang Supabase.' },
    { label: 'Sales report', desc: 'Makikita mo kung magkano ang kinita mo araw-araw/linggo-linggo.' },
    { label: 'Gumagana kahit walang internet', desc: 'Puwede ka pa ring mag-benta kahit nawalan ng WiFi/data.' },
    { label: 'Barcode scanning', desc: 'I-scan mo lang ang barcode ng produkto.' }
  ],
  'Booking / Reservation': [
    { label: 'Online booking/calendar', desc: 'Makikita ng customer ang bakanteng oras/araw.' },
    { label: 'SMS/email reminder sa customer', desc: 'Awtomatikong paalala bago ang appointment.' },
    { label: 'Online deposit/bayad', desc: 'Kailangan munang magbayad ng deposit bago ma-confirm.' },
    { label: 'Account ng customer', desc: 'Makikita ng customer ang mga dati at paparating niyang booking.' },
    { label: 'Admin panel', desc: 'Puwede mong kontrolin at tingnan ang lahat ng booking at customer mo.' },
    { label: 'Secure na database', desc: 'Ligtas ang datos ng customer gamit ang Supabase.' },
    { label: 'Schedule management ng maraming staff', desc: 'Bawat staff/stylist may sariling schedule.' }
  ],
  'Food Delivery': [
    { label: 'Live tracking ng order/rider', desc: 'Makikita ng customer sa mapa kung saan na ang order/rider niya.' },
    { label: 'Online payment (GCash/Card)', desc: 'Direktang babayaran ka sa app.' },
    { label: 'Account ng customer', desc: 'Makikita nila ang sarili nilang order history.' },
    { label: 'Admin panel', desc: 'Puwede mong kontrolin at tingnan ang lahat ng order, resto/branch, at rider.' },
    { label: 'Secure na database', desc: 'Ligtas ang datos ng customer gamit ang Supabase.' },
    { label: 'Push notification updates', desc: 'Abiso kapag na-confirm, na-cook, o padating na ang order.' },
    { label: 'Maraming branch/resto', desc: 'Kayang i-manage lahat ng sanga sa iisang app.' },
    { label: 'Rating/review ng customer', desc: 'Puwedeng mag-iwan ng rating pagkatapos ng order.' }
  ],
  'Portfolio / Company Website': [
    { label: 'Contact form', desc: 'May form na puwedeng sagutan ng bisita para makausap ka.' },
    { label: 'Gallery ng mga larawan/portfolio', desc: 'Page na puwedeng i-browse ang mga larawan ng dati mong ginawa.' },
    { label: 'Madaling palitan ang content (admin panel)', desc: 'Puwede mong palitan ang text/larawan nang hindi mag-code.' },
    { label: 'Blog/News section', desc: 'Puwede kang mag-post ng balita/artikulo.' },
    { label: 'Filipino at English na bersyon', desc: 'Puwedeng ipalit ang wika ng website.' }
  ],
  'Inventory Management': [
    { label: 'Barcode scanning', desc: 'I-scan mo lang ang barcode para agad ma-update ang stock.' },
    { label: 'Maraming warehouse/branch', desc: 'Kaya i-track ang stock sa magkakaibang lokasyon.' },
    { label: 'Automatic alert kapag paubos na ang stock', desc: 'Mapapaalala ka bago talaga maubos ang isang item.' },
    { label: 'Admin panel', desc: 'Puwede mong kontrolin at tingnan ang lahat ng stock at staff mo.' },
    { label: 'Secure na database', desc: 'Ligtas ang datos ng negosyo mo gamit ang Supabase.' },
    { label: 'Reports', desc: 'Makikita mo ang buod ng stock movement.' }
  ],
  'Landing Page': [
    { label: 'Contact form', desc: 'May form na puwedeng sagutan ng bisita para makausap ka.' },
    { label: 'Social media links', desc: 'May mga icon/link papunta sa Facebook, Instagram, atbp.' },
    { label: 'Newsletter/Email signup', desc: 'Puwedeng mag-iwan ng email ang bisita.' },
    { label: 'Secure na database para sa mga inquiry', desc: 'Ligtas ang mga email/inquiry na natatanggap mo gamit ang Supabase.' }
  ],
  'School / LMS': [
    { label: 'Online quiz/exam', desc: 'Puwedeng gumawa ng pagsusulit na online.' },
    { label: 'Grade tracking', desc: 'Makikita ng estudyante/guro ang mga grado.' },
    { label: 'Video/file upload ng mga lesson', desc: 'Puwedeng mag-upload ang guro ng video/PDF na aralin.' },
    { label: 'Access para sa magulang/guardian', desc: 'May sariling login din ang magulang.' },
    { label: 'Admin panel', desc: 'Puwede mong kontrolin at tingnan ang lahat ng estudyante, guro, at grado.' },
    { label: 'Secure na database', desc: 'Ligtas ang datos ng estudyante/guro gamit ang Supabase.' }
  ],
  'Other': [
    { label: 'Account/login ng users', desc: 'Bawat gumagamit ay may sarili niyang account.' },
    { label: 'Online payment', desc: 'Puwedeng magbayad online sa loob mismo ng app/website.' },
    { label: 'Admin panel', desc: 'Puwede mong kontrolin at tingnan ang lahat ng users at data mo.' },
    { label: 'Secure na database', desc: 'Ligtas ang datos ng users mo gamit ang Supabase.' },
    { label: 'Notifications (SMS/Email/Push)', desc: 'Awtomatikong abiso sa users tungkol sa mga update.' }
  ]
};

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

// ============ SMART BID RANKING / MATCH SCORE ============
// Composite score (0-100): 50% developer rating, 20% track record (review count,
// caps at 10), 30% price competitiveness within the client's stated budget.
// New developers (no reviews) can still rank #1 by pricing competitively.

function computeMatchScore(offer, budgetMin, budgetMax, ratingsMap) {
  const rating = ratingsMap.get(offer.developer_id);
  const ratingScore = rating ? (rating.avg / 5) * 50 : 0;
  const trackScore = rating ? Math.min(rating.count / 10, 1) * 20 : 0;

  let priceScore = 15; // neutral default if budget range is degenerate (min === max)
  if (budgetMax > budgetMin) {
    const normalized = (offer.price - budgetMin) / (budgetMax - budgetMin);
    priceScore = (1 - Math.min(Math.max(normalized, 0), 1)) * 30;
  }

  return Math.round(ratingScore + trackScore + priceScore);
}

function rankOffers(offers, budgetMin, budgetMax, ratingsMap) {
  const scored = offers.map(o => ({ offer: o, score: computeMatchScore(o, budgetMin, budgetMax, ratingsMap) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.offer);
}

// ============ PAYMENT INFO ============
function paymentInfoHtml(profile) {
  const rows = [];
  if (profile.paypal_email) rows.push('PayPal (international): <strong>' + escapeHtml(profile.paypal_email) + '</strong>');
  if (profile.bank_name) {
    rows.push('Bank: <strong>' + escapeHtml(profile.bank_name) +
      (profile.bank_account_name ? ' — ' + escapeHtml(profile.bank_account_name) : '') +
      (profile.bank_account_number ? ' · Acct #: ' + escapeHtml(profile.bank_account_number) : '') +
      (profile.swift_code ? ' (SWIFT: ' + escapeHtml(profile.swift_code) + ')' : '') + '</strong>');
  }
  if (!rows.length) return '<div style="font-size:13px;color:var(--muted);margin-top:6px">No payment info added yet.</div>';
  return '<div style="margin-top:6px;font-size:14px;line-height:1.6">' + rows.join('<br>') + '</div>';
}

// Fills a payment-info edit form (with the given id prefix) from a profile row.
// The bank fields live in a collapsible section — auto-expand it if bank info already exists.
function fillPaymentForm(prefix, profile) {
  document.getElementById(prefix + '-paypal').value = profile.paypal_email || '';
  document.getElementById(prefix + '-bank-name').value = profile.bank_name || '';
  document.getElementById(prefix + '-bank-account').value = profile.bank_account_name || '';
  document.getElementById(prefix + '-bank-number').value = profile.bank_account_number || '';
  document.getElementById(prefix + '-swift').value = profile.swift_code || '';
  if (profile.bank_name) {
    document.getElementById(prefix + '-bank-section').style.display = 'block';
  }
}

function toggleBankForm(prefix) {
  const el = document.getElementById(prefix + '-bank-section');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function savePaymentInfo(prefix, userId, errElId, okElId) {
  const errEl = document.getElementById(errElId);
  const okEl = document.getElementById(okElId);
  errEl.textContent = '';
  okEl.style.display = 'none';

  const { error } = await db.from('profiles').update({
    paypal_email: document.getElementById(prefix + '-paypal').value.trim() || null,
    bank_name: document.getElementById(prefix + '-bank-name').value.trim() || null,
    bank_account_name: document.getElementById(prefix + '-bank-account').value.trim() || null,
    bank_account_number: document.getElementById(prefix + '-bank-number').value.trim() || null,
    swift_code: document.getElementById(prefix + '-swift').value.trim() || null
  }).eq('id', userId);

  if (error) { errEl.textContent = error.message; return; }
  okEl.style.display = 'block';
}
