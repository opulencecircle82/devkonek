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

// ============ PRICE ESTIMATOR ============
// Rule-based estimate — no external AI needed. Base price per category x type
// multiplier, plus a flat range per selected feature.

const ESTIMATOR_BASE = {
  'E-commerce / Online Store': { min: 15000, max: 30000, weeks: 3 },
  'POS System': { min: 15000, max: 35000, weeks: 4 },
  'Booking / Reservation': { min: 10000, max: 25000, weeks: 3 },
  'Food Delivery': { min: 20000, max: 40000, weeks: 4 },
  'Portfolio / Company Website': { min: 5000, max: 15000, weeks: 2 },
  'Inventory Management': { min: 15000, max: 30000, weeks: 3 },
  'Landing Page': { min: 3000, max: 8000, weeks: 1 },
  'School / LMS': { min: 25000, max: 60000, weeks: 6 },
  'Other': { min: 8000, max: 20000, weeks: 2 }
};

const ESTIMATOR_TYPE_MULTIPLIER = { website: 1, mobile_app: 1.6, both: 2.2 };

// Checklist is phrased in plain business terms per category — clients don't know what
// "API Integration" means, but they know what "kaya mag-print ng resibo" means. The
// technical how is left to developers to figure out and compete on (contest model).
const CATEGORY_FEATURES = {
  'E-commerce / Online Store': [
    { key: 'payment', label: 'Puwedeng magbayad online (GCash, Card, atbp.)', desc: 'Direktang babayaran ka ng customer sa app/website — hindi na COD/manual lang.', min: 8000, max: 15000, weeks: 1 },
    { key: 'accounts', label: 'May sariling account/login ang bawat customer (signup method)', desc: 'Makikita nila ang sarili nilang order history kapag bumalik sila. Kasama na dito kung paano sila magsi-sign up (email, phone number, atbp.).', min: 3000, max: 5000, weeks: 0.5 },
    { key: 'admin', label: 'Sarili mong admin panel?', desc: 'Ito ang magiging admin mo — puwede mong kontrolin at tingnan ang lahat ng users, order, at produkto mo, hindi kailangan mag-code.', min: 5000, max: 10000, weeks: 1 },
    { key: 'security', label: 'Secure na database?', desc: 'Sisiguraduhin naming ligtas ang datos ng iyong mga customer gamit ang trusted na 3rd-party na database tulad ng Supabase — hindi basta-basta makikita o magagamit ng ibang tao.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'stock', label: 'May makikitang stock ng mga paninda', desc: 'Makikita mo (at ng customer) kung ilan pa ang natitirang paninda.', min: 4000, max: 8000, weeks: 1 },
    { key: 'search', label: 'May search at filter ng produkto', desc: 'Puwedeng maghanap ang customer ng specific na item o i-filter by category/presyo.', min: 2000, max: 4000, weeks: 0.5 },
    { key: 'notify', label: 'SMS/Email updates sa customer (order status)', desc: 'Awtomatikong mapapadalhan ng SMS/email ang customer kapag na-confirm o na-deliver na ang order.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'delivery', label: 'Tracking ng delivery/rider', desc: 'Makikita ng customer kung saan na ang delivery/rider niya sa real-time.', min: 5000, max: 10000, weeks: 1 }
  ],
  'POS System': [
    { key: 'receipt', label: 'Kaya mag-print ng resibo', desc: 'Direktang puwedeng i-print ang resibo sa printer mo pagkatapos ng bawat benta.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'stock', label: 'May stock/inventory tracking', desc: 'Awtomatikong babawasan ang stock count kada benta, makikita mo agad kung kailan mag-re-restock.', min: 4000, max: 8000, weeks: 1 },
    { key: 'staff', label: 'Maraming cashier/staff account (signup method)', desc: 'Bawat empleyado may sariling account/login, para malaman mo kung sino ang nag-transact.', min: 3000, max: 5000, weeks: 0.5 },
    { key: 'admin', label: 'Sarili mong admin panel?', desc: 'Ito ang magiging admin mo — puwede mong kontrolin at tingnan ang lahat ng staff, benta, at produkto mo, hindi kailangan mag-code.', min: 5000, max: 10000, weeks: 1 },
    { key: 'security', label: 'Secure na database?', desc: 'Sisiguraduhin naming ligtas ang datos ng benta/staff mo gamit ang trusted na 3rd-party na database tulad ng Supabase.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'reports', label: 'May sales report', desc: 'Makikita mo kung magkano ang kinita mo araw-araw/linggo-linggo, pinakamabenta na item, atbp.', min: 4000, max: 8000, weeks: 1 },
    { key: 'offline', label: 'Gumagana kahit walang internet', desc: 'Puwede ka pa ring mag-benta kahit nawalan ng WiFi/data — mag-sy-sync na lang pag bumalik ang internet.', min: 5000, max: 10000, weeks: 1 },
    { key: 'barcode', label: 'Barcode scanning', desc: 'I-scan mo lang ang barcode ng produkto, hindi na kailangan mag-type ng presyo.', min: 3000, max: 6000, weeks: 0.5 }
  ],
  'Booking / Reservation': [
    { key: 'calendar', label: 'Online booking/calendar', desc: 'Makikita ng customer ang bakanteng oras/araw at puwede silang mag-book kahit saan.', min: 4000, max: 8000, weeks: 1 },
    { key: 'reminder', label: 'SMS/email reminder sa customer', desc: 'Awtomatikong paalala bago ang appointment, para mabawasan ang no-show.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'deposit', label: 'Online deposit/bayad', desc: 'Kailangan munang magbayad ng deposit ang customer bago ma-confirm ang booking niya.', min: 8000, max: 15000, weeks: 1 },
    { key: 'accounts', label: 'May account ang customer (signup method, booking history)', desc: 'Makikita ng customer ang mga dati at paparating niyang booking. Kasama na dito kung paano sila magsi-sign up.', min: 3000, max: 5000, weeks: 0.5 },
    { key: 'admin', label: 'Sarili mong admin panel?', desc: 'Ito ang magiging admin mo — puwede mong kontrolin at tingnan ang lahat ng booking at customer mo, hindi kailangan mag-code.', min: 5000, max: 10000, weeks: 1 },
    { key: 'security', label: 'Secure na database?', desc: 'Sisiguraduhin naming ligtas ang datos ng iyong mga customer gamit ang trusted na 3rd-party na database tulad ng Supabase.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'schedule', label: 'Schedule management ng maraming staff', desc: 'Kung marami kang empleyado/stylist/atbp., bawat isa may sariling schedule na makikita.', min: 4000, max: 8000, weeks: 1 }
  ],
  'Food Delivery': [
    { key: 'tracking', label: 'Live tracking ng order/rider', desc: 'Makikita ng customer sa mapa kung saan na ang order/rider niya, parang Grab/Foodpanda.', min: 8000, max: 15000, weeks: 1.5 },
    { key: 'payment', label: 'Online payment (GCash/Card)', desc: 'Direktang babayaran ka sa app — hindi na cash-on-delivery lang.', min: 8000, max: 15000, weeks: 1 },
    { key: 'accounts', label: 'May account ang customer (signup method)', desc: 'Makikita nila ang sarili nilang order history. Kasama na dito kung paano sila magsi-sign up.', min: 3000, max: 5000, weeks: 0.5 },
    { key: 'admin', label: 'Sarili mong admin panel?', desc: 'Ito ang magiging admin mo — puwede mong kontrolin at tingnan ang lahat ng order, resto/branch, at rider.', min: 5000, max: 10000, weeks: 1 },
    { key: 'security', label: 'Secure na database?', desc: 'Sisiguraduhin naming ligtas ang datos ng iyong mga customer gamit ang trusted na 3rd-party na database tulad ng Supabase.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'notify', label: 'Push notification updates', desc: 'Awtomatikong notification sa customer kapag na-confirm, na-cook, o padating na ang order.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'branches', label: 'Maraming branch/resto', desc: 'Kung marami kang sanga/partner na resto, kayang i-manage lahat sa iisang app.', min: 5000, max: 10000, weeks: 1 },
    { key: 'rating', label: 'Rating/review ng customer', desc: 'Puwedeng mag-iwan ng rating/review ang customer pagkatapos ng order.', min: 2000, max: 4000, weeks: 0.5 }
  ],
  'Portfolio / Company Website': [
    { key: 'contact', label: 'Contact form', desc: 'May form na puwedeng sagutan ng bisita para direktang makausap ka.', min: 2000, max: 4000, weeks: 0.5 },
    { key: 'gallery', label: 'Gallery ng mga larawan/portfolio', desc: 'Page na puwedeng i-browse ang mga larawan ng dati mong ginawa/trabaho.', min: 2000, max: 4000, weeks: 0.5 },
    { key: 'admin', label: 'Madali mong mapapalitan ang content nang wala kang admin panel?', desc: 'Ito ang magiging admin mo — puwede mong palitan ang text/larawan sa website mo nang hindi kailangan mag-code o tumawag pa ng developer.', min: 4000, max: 8000, weeks: 1 },
    { key: 'blog', label: 'Blog/News section', desc: 'Puwede kang mag-post ng balita/artikulo na makikita ng mga bisita.', min: 3000, max: 6000, weeks: 1 },
    { key: 'multilang', label: 'Filipino at English na bersyon', desc: 'Puwedeng ipalit ang wika ng website depende sa gusto ng bisita.', min: 3000, max: 6000, weeks: 0.5 }
  ],
  'Inventory Management': [
    { key: 'barcode', label: 'Barcode scanning', desc: 'I-scan mo lang ang barcode para agad malaman/ma-update ang stock.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'branches', label: 'Maraming warehouse/branch', desc: 'Kaya i-track ang stock sa magkakaibang lokasyon nang magkakahiwalay.', min: 5000, max: 10000, weeks: 1 },
    { key: 'alerts', label: 'Automatic alert kapag paubos na ang stock', desc: 'Mapapaalala ka bago talaga maubos ang isang item, para makapag-order ka agad.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'admin', label: 'Sarili mong admin panel?', desc: 'Ito ang magiging admin mo — puwede mong kontrolin at tingnan ang lahat ng stock at staff mo, hindi kailangan mag-code.', min: 5000, max: 10000, weeks: 1 },
    { key: 'security', label: 'Secure na database?', desc: 'Sisiguraduhin naming ligtas ang datos ng negosyo mo gamit ang trusted na 3rd-party na database tulad ng Supabase.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'reports', label: 'Reports', desc: 'Makikita mo ang buod ng stock movement — anong pumapasok/lumalabas.', min: 4000, max: 8000, weeks: 1 }
  ],
  'Landing Page': [
    { key: 'contact', label: 'Contact form', desc: 'May form na puwedeng sagutan ng bisita para direktang makausap ka.', min: 2000, max: 4000, weeks: 0.5 },
    { key: 'social', label: 'Social media links', desc: 'May mga icon/link papunta sa Facebook, Instagram, atbp. mo.', min: 1000, max: 2000, weeks: 0.5 },
    { key: 'newsletter', label: 'Newsletter/Email signup', desc: 'Puwedeng mag-iwan ng email ang bisita para bigyan mo ng updates/promo sa hinaharap.', min: 2000, max: 4000, weeks: 0.5 },
    { key: 'security', label: 'Secure na database para sa mga email/inquiry?', desc: 'Sisiguraduhin naming ligtas ang mga email/inquiry na natatanggap mo gamit ang trusted na 3rd-party na database tulad ng Supabase.', min: 2000, max: 4000, weeks: 0.5 }
  ],
  'School / LMS': [
    { key: 'quiz', label: 'Online quiz/exam', desc: 'Puwedeng gumawa ng pagsusulit na online sasagutan ng mga estudyante.', min: 5000, max: 10000, weeks: 1 },
    { key: 'grades', label: 'Grade tracking', desc: 'Makikita ng estudyante/guro ang mga grado sa isang lugar.', min: 4000, max: 8000, weeks: 1 },
    { key: 'upload', label: 'Video/file upload ng mga lesson', desc: 'Puwedeng mag-upload ang guro ng video/PDF na aralin, mababasa/mapapanood ng estudyante anumang oras.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'parent', label: 'Access para sa magulang/guardian (signup method)', desc: 'May sariling login din ang magulang para masubaybayan ang progress ng anak.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'admin', label: 'Sarili mong admin panel?', desc: 'Ito ang magiging admin mo — puwede mong kontrolin at tingnan ang lahat ng estudyante, guro, at grado, hindi kailangan mag-code.', min: 5000, max: 10000, weeks: 1 },
    { key: 'security', label: 'Secure na database?', desc: 'Sisiguraduhin naming ligtas ang datos ng estudyante/guro gamit ang trusted na 3rd-party na database tulad ng Supabase.', min: 3000, max: 6000, weeks: 0.5 }
  ],
  'Other': [
    { key: 'accounts', label: 'May account/login ang users (signup method)', desc: 'Bawat gumagamit ay may sarili niyang account. Kasama na dito kung paano sila magsi-sign up.', min: 3000, max: 5000, weeks: 0.5 },
    { key: 'payment', label: 'Online payment', desc: 'Puwedeng magbayad online sa loob mismo ng app/website.', min: 8000, max: 15000, weeks: 1 },
    { key: 'admin', label: 'Sarili mong admin panel?', desc: 'Ito ang magiging admin mo — puwede mong kontrolin at tingnan ang lahat ng users at data mo, hindi kailangan mag-code.', min: 5000, max: 10000, weeks: 1 },
    { key: 'security', label: 'Secure na database?', desc: 'Sisiguraduhin naming ligtas ang datos ng users mo gamit ang trusted na 3rd-party na database tulad ng Supabase.', min: 3000, max: 6000, weeks: 0.5 },
    { key: 'notify', label: 'Notifications (SMS/Email/Push)', desc: 'Awtomatikong mapapadalhan ng abiso ang users tungkol sa mga update.', min: 3000, max: 6000, weeks: 0.5 }
  ]
};

function estimateProject(category, type, selectedFeatureKeys) {
  const base = ESTIMATOR_BASE[category] || ESTIMATOR_BASE['Other'];
  const mult = ESTIMATOR_TYPE_MULTIPLIER[type] || 1;
  const features = CATEGORY_FEATURES[category] || CATEGORY_FEATURES['Other'];
  let min = base.min * mult;
  let max = base.max * mult;
  let weeks = base.weeks;
  features.forEach(f => {
    if (selectedFeatureKeys.includes(f.key)) {
      min += f.min;
      max += f.max;
      weeks += f.weeks;
    }
  });
  return { min: Math.round(min / 500) * 500, max: Math.round(max / 500) * 500, weeks: Math.ceil(weeks) };
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
