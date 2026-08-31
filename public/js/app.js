const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

/* Menu toggle */
const menu = $('.menu'), nav = $('#main-nav');
if (menu && nav) menu.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});

/* Year */
$$('[data-year]').forEach(x => x.textContent = new Date().getFullYear());

/* AJAX form submission */
async function sendForm(form) {
  if (location.protocol === 'file:') {
    const s = form.querySelector('.form-status');
    s.className = 'form-status error';
    s.textContent = 'Forms work after starting the included Node.js server (npm install, then npm start).';
    return;
  }
  const status = form.querySelector('.form-status');
  status.className = 'form-status';
  status.textContent = 'Submitting…';
  const data = new FormData(form);
  try {
    const res = await fetch(form.action, { method: 'POST', body: data });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Submission failed.');
    status.classList.add('success');
    status.textContent = json.message;
    form.reset();
  } catch (e) {
    status.classList.add('error');
    status.textContent = e.message;
  }
}
$$('form[data-ajax]').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); sendForm(f); }));

/* Job filtering */
const jobs = $$('[data-job-card]');
const q = $('#job-q'), loc = $('#job-location'), type = $('#job-type'), count = $('#job-count');
function filterJobs() {
  if (!jobs.length) return;
  let n = 0;
  const query = (q?.value || '').toLowerCase(), location = (loc?.value || '').toLowerCase(), jobType = (type?.value || '').toLowerCase();
  jobs.forEach(card => {
    const ok = (!query || card.dataset.search.includes(query)) && (!location || card.dataset.location.includes(location)) && (!jobType || card.dataset.type === jobType);
    card.classList.toggle('hidden', !ok);
    if (ok) n++;
  });
  if (count) count.textContent = `${n} role${n === 1 ? '' : 's'} found`;
}
[q, loc, type].filter(Boolean).forEach(x => x.addEventListener(x.tagName === 'SELECT' ? 'change' : 'input', filterJobs));
filterJobs();

/* Scroll progress + header state + back-to-top */
const progress = document.createElement('div');
progress.className = 'scroll-progress';
progress.setAttribute('aria-hidden', 'true');
document.body.appendChild(progress);

const toTop = document.createElement('button');
toTop.className = 'to-top';
toTop.setAttribute('aria-label', 'Back to top');
toTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
document.body.appendChild(toTop);
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

const header = $('.site-header');
function onScroll() {
  const y = window.scrollY;
  const h = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.width = h > 0 ? (y / h) * 100 + '%' : '0%';
  if (header) header.classList.toggle('scrolled', y > 30);
  if (toTop) toTop.classList.toggle('show', y > 600);
}
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { onScroll(); ticking = false; });
}, { passive: true });
onScroll();

/* Reveal observer with stagger */
const revealItems = $$('.reveal');
if (revealItems.length) {
  const staggerGrids = ['home-capabilities', 'service-family-grid', 'cards', 'process', 'delivery-grid', 'managed-grid', 'proof-grid', 'solution-grid', 'contact-cards'];
  if ('IntersectionObserver' in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
    revealItems.forEach(el => {
      const parent = el.parentElement;
      if (parent && parent.children.length > 1 && parent.classList.length && staggerGrids.some(c => parent.classList.contains(c))) {
        const i = Array.from(parent.children).indexOf(el);
        el.style.setProperty('--reveal-delay', Math.min(i * 80, 400) + 'ms');
      }
      revealObserver.observe(el);
    });
  } else {
    revealItems.forEach(el => el.classList.add('in-view'));
  }
}

/* Marquee seamless loop */
const marqueeTrack = $('.marquee-track');
if (marqueeTrack && marqueeTrack.children.length) {
  marqueeTrack.innerHTML += marqueeTrack.innerHTML;
}

/* Animated counters */
const counters = $$('[data-count]');
if (counters.length && 'IntersectionObserver' in window) {
  const fmt = n => Number(n).toLocaleString('en-US');
  const counterObserver = new IntersectionObserver((entries, obs) => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    obs.unobserve(el);
    const target = parseFloat(el.dataset.count || '0');
    const dur = reduceMotion ? 0 : 1200;
    const suffix = el.dataset.suffix || '';
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = target * eased;
      el.textContent = (dur === 0 ? target : value).toFixed(0) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }), { threshold: 0.5 });
  counters.forEach(c => counterObserver.observe(c));
}

/* Service sub-nav active state */
const serviceLinks = $$('.service-nav a');
if (serviceLinks.length && 'IntersectionObserver' in window) {
  const targets = serviceLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      serviceLinks.forEach(a => a.classList.toggle('current', a.getAttribute('href') === '#' + entry.target.id));
    }
  }), { rootMargin: '-30% 0px -60% 0px' });
  targets.forEach(t => sectionObserver.observe(t));
}
