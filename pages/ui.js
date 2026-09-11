// Presentation and accessibility shared by North's extension pages.
// Blocking rules and challenge timing stay in their existing controllers.
(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const icons = {
    blocklist: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9h16M9 9v11"/>',
    shorts: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="m10 8 5 4-5 4Z"/>',
    keywords: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    youtube: '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/>',
    social: '<path d="M20 11a8 8 0 0 1-8 8H4l1-5a8 8 0 1 1 15-3Z"/>',
    news: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/>',
    strict: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    lockdown: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    stats: '<path d="M5 20v-6M12 20V9M19 20V4"/>',
    more: '<path d="M3 7h18M3 17h18"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>'
  };
  const nav = [...document.querySelectorAll('.nav-item')];
  nav.forEach((button, index) => {
    const label = button.textContent.trim();
    button.insertAdjacentHTML('afterbegin', `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[button.dataset.section] || ''}</svg>`);
    const section = document.getElementById('sec-' + button.dataset.section);
    button.setAttribute('aria-controls', section.id);
    const heading = section.querySelector('h1');
    heading.id = section.id + '-heading';
    heading.tabIndex = -1;
    section.setAttribute('aria-labelledby', heading.id);
    if (!section.querySelector('.eyebrow')) {
      const eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = `${String(index + 1).padStart(2, '0')} / ${label}`;
      heading.before(eyebrow);
    }
    button.setAttribute('aria-current', button.classList.contains('active') ? 'page' : 'false');
    button.addEventListener('click', () => {
      nav.forEach(b => b.setAttribute('aria-current', b === button ? 'page' : 'false'));
      heading.focus({ preventScroll: true });
      if (matchMedia('(max-width: 760px)').matches) section.scrollIntoView({ block: 'start', behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });

  // The compass keeps its split needle at every size and in both themes.
  document.querySelectorAll('.north-arrow').forEach(svg => {
    svg.innerHTML = '<path d="M12 1.5 20 22 12 17.3 4 22Z"/><path d="M12 1.5v15.8" fill="none" stroke="var(--bg)" stroke-width=".8"/>';
  });

  document.querySelectorAll('.setting-row').forEach((row, index) => {
    const heading = row.querySelector('h3');
    if (!heading) return;
    if (!heading.id) heading.id = 'setting-label-' + index;
    row.querySelectorAll('input, select').forEach(input => {
      if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby')) input.setAttribute('aria-labelledby', heading.id);
    });
  });
  document.querySelectorAll('.more-presets summary').forEach(summary => {
    summary.setAttribute('aria-label', 'More site suggestions');
  });

  // Content remains visible without JavaScript or IntersectionObserver.
  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('reveal-enter');
        observer.unobserve(entry.target);
      });
    }, { threshold: .08 });
    document.querySelectorAll('.setting-card').forEach(card => observer.observe(card));
  }

  // Existing controllers open/close these panels. Keep focus inside whichever
  // dialog is visible, and return it to the initiating control on dismissal.
  const backdrops = [...document.querySelectorAll('.modal-backdrop')];
  let active = null;
  let returnFocus = null;
  const focusable = panel => [...panel.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')]
    .filter(el => !el.disabled && el.getClientRects().length);
  backdrops.forEach((backdrop, index) => {
    const panel = backdrop.querySelector('.modal');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.tabIndex = -1;
    panel.setAttribute('aria-label', ['Change protection', 'Edit site', 'Welcome to North'][index]);
    panel.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        const items = focusable(panel);
        const first = items[0] || panel, last = items.at(-1) || panel;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      if (event.key === 'Escape') {
        const cancel = panel.querySelector('#edit-cancel') || (panel.querySelector('#gate-wait:not(.hidden)') ? panel.querySelector('#gate-cancel-wait') : panel.querySelector('#gate-cancel'));
        if (cancel) { event.preventDefault(); cancel.click(); }
      }
    });
  });
  const syncDialog = () => {
    const next = backdrops.find(b => !b.classList.contains('hidden')) || null;
    if (next === active) return;
    const layout = document.querySelector('.layout');
    if (next) {
      if (!active) returnFocus = document.activeElement;
      active = next;
      if (layout) layout.inert = true;
      document.body.style.overflow = 'hidden';
      const panel = next.querySelector('.modal');
      (focusable(panel)[0] || panel).focus({ preventScroll: true });
    } else {
      active = null;
      if (layout) layout.inert = false;
      document.body.style.overflow = '';
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    }
  };
  if (backdrops.length) {
    const observer = new MutationObserver(syncDialog);
    backdrops.forEach(b => observer.observe(b, { attributes: true, attributeFilter: ['class'] }));
    syncDialog();
  }
})();
