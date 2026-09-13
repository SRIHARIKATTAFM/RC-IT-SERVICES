export const ADMIN_INTERACTION_PATH = '/__rc-admin/interactions.js';
export const ADMIN_SOFT_SUBMIT_HEADER = 'x-rc-admin-soft-submit';

export const ADMIN_INTERACTION_STYLE = `<style data-rc-admin-interactions>
html.rc-admin-busy{cursor:progress}.rc-admin-dialog{width:min(1120px,calc(100vw - 40px));max-width:1120px;max-height:calc(100dvh - 40px);padding:0;border:1px solid var(--line-strong);border-radius:6px;background:var(--page);color:var(--text);box-shadow:0 28px 80px rgba(11,20,36,.28)}.rc-admin-dialog::backdrop{background:rgba(11,20,36,.56);backdrop-filter:blur(2px)}.rc-admin-dialog-shell{display:flex;max-height:calc(100dvh - 40px);min-height:min(680px,calc(100dvh - 40px));flex-direction:column}.rc-admin-dialog-bar{position:sticky;top:0;z-index:5;display:flex;min-height:54px;align-items:center;justify-content:space-between;gap:16px;padding:10px 14px 10px 18px;border-bottom:1px solid var(--line);background:#fff}.rc-admin-dialog-bar h2{min-width:0;margin:0;overflow:hidden;color:var(--ink);font-size:13px;font-weight:730;text-overflow:ellipsis;white-space:nowrap}.rc-admin-dialog-close{display:inline-grid;width:38px;height:38px;flex:0 0 38px;place-items:center;border:1px solid var(--line-strong);border-radius:3px;background:#fff;color:var(--text);font-size:20px;line-height:1;cursor:pointer}.rc-admin-dialog-close:hover{background:var(--surface-subtle)}.rc-admin-dialog-body{min-height:0;overflow:auto;padding:20px 22px 28px;-webkit-overflow-scrolling:touch}.rc-admin-dialog-body>.page-heading{margin-top:0}.rc-admin-dialog-body>.footerline{margin-bottom:0}.rc-admin-dialog-loading{display:grid;min-height:260px;place-items:center;color:var(--muted);font-size:12px}.rc-admin-dialog-error{padding:28px 18px;text-align:center}.rc-admin-dialog-error strong{display:block;margin-bottom:8px}.rc-admin-dialog .workspace-bar,.rc-admin-dialog .global-header{display:none!important}.rc-admin-dialog .data-plane{overflow:visible}.rc-admin-dialog [data-rc-hard-document]{text-decoration:underline}.rc-admin-live-region{position:fixed!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
@media(max-width:900px){.rc-admin-dialog{width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}.rc-admin-dialog-shell{max-height:calc(100dvh - 24px);min-height:calc(100dvh - 24px)}.rc-admin-dialog-body{padding:16px}.rc-admin-dialog-body .page-heading{grid-template-columns:1fr!important}.rc-admin-dialog-body .snapshot{text-align:left!important;white-space:normal!important}.rc-admin-dialog-body .data-plane form[style*="grid-template-columns"],.rc-admin-dialog-body .data-plane>div[style*="grid-template-columns"]{grid-template-columns:1fr!important}}
@media(max-width:640px){.rc-admin-dialog{width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;border:0;border-radius:0}.rc-admin-dialog-shell{height:100dvh;max-height:100dvh;min-height:100dvh}.rc-admin-dialog-bar{padding-left:max(14px,env(safe-area-inset-left));padding-right:max(14px,env(safe-area-inset-right))}.rc-admin-dialog-body{padding:16px 14px max(28px,env(safe-area-inset-bottom))}.rc-admin-dialog-body .page-heading h1{font-size:26px!important}.rc-admin-dialog-body .section-header{flex-direction:column!important;align-items:stretch!important}.rc-admin-dialog-body .actions{display:grid!important;grid-template-columns:1fr!important}.rc-admin-dialog-body .actions .btn,.rc-admin-dialog-body .actions form,.rc-admin-dialog-body .actions form .btn{width:100%!important}}
</style>`;

function rcAdminInteractionsBootstrap() {
  if (window.__rcAdminInteractions) return;
  window.__rcAdminInteractions = true;

  const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  const modalPatterns = [
    /^\/jobs\/new$/,
    new RegExp(`^/jobs/${UUID}/(?:edit|preview|delete)$`, 'i'),
    new RegExp(`^/applications/${UUID}$`, 'i')
  ];
  const documentPattern = new RegExp(`^/applications/${UUID}/documents/${UUID}$`, 'i');
  const topLevelPaths = new Set(['/', '/jobs', '/applications', '/security', '/change-password']);
  const hardPostPaths = new Set(['/login', '/logout', '/forgot-password', '/reset-password']);

  let navigationController = null;
  let modalController = null;
  let activeDialog = null;
  let activeTrigger = null;
  let modalDirty = false;
  let skipCloseRefresh = false;

  const sameOriginUrl = (value) => {
    try { const url = new URL(value, location.href); return url.origin === location.origin ? url : null; }
    catch { return null; }
  };
  const isModalPath = (pathname) => modalPatterns.some((pattern) => pattern.test(pathname));
  const isDocumentPath = (pathname) => documentPattern.test(pathname);
  const isSoftGetPath = (pathname) => topLevelPaths.has(pathname) || isModalPath(pathname);
  const isHtml = (response) => (response.headers.get('content-type') || '').toLowerCase().includes('text/html');

  function announce(message) {
    let live = document.querySelector('.rc-admin-live-region');
    if (!live) { live = document.createElement('div'); live.className = 'rc-admin-live-region'; live.setAttribute('role','status'); live.setAttribute('aria-live','polite'); document.body.append(live); }
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = message; });
  }

  function setBusy(busy) {
    document.documentElement.classList.toggle('rc-admin-busy', busy);
    const main = document.querySelector('main#main-content');
    if (main) main.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function rememberScroll() {
    const current = history.state && typeof history.state === 'object' ? history.state : {};
    history.replaceState({ ...current, rcAdmin: true, scrollY: window.scrollY }, '', location.href);
  }

  function syncNavigationState(url) {
    const route = url.pathname.startsWith('/jobs') ? 'jobs' : url.pathname.startsWith('/applications') ? 'applications' : (url.pathname === '/security' || url.pathname === '/change-password') ? 'security' : 'overview';
    for (const link of document.querySelectorAll('.primary-nav a[href],.mobile-menu a[href]')) {
      const target = sameOriginUrl(link.href); if (!target) continue;
      const targetRoute = target.pathname.startsWith('/jobs') ? 'jobs' : target.pathname.startsWith('/applications') ? 'applications' : (target.pathname === '/security' || target.pathname === '/change-password') ? 'security' : target.pathname === '/' ? 'overview' : '';
      if (targetRoute === route) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    }
    for (const details of document.querySelectorAll('details.mobile-nav[open]')) details.open = false;
  }

  function parseDocument(html) { return new DOMParser().parseFromString(html, 'text/html'); }

  function syncNoExpiry(root = document) {
    for (const box of root.querySelectorAll('input[name="no_expiry"]')) {
      const form = box.closest('form');
      const end = form?.querySelector('input[name="closes_at"]');
      if (!(end instanceof HTMLInputElement)) continue;
      end.disabled = box.checked;
      end.setAttribute('aria-disabled', box.checked ? 'true' : 'false');
    }
  }

  function applyTopLevelDocument(nextDocument, url, { historyMode = 'push', scrollY = 0 } = {}) {
    const currentShell = document.querySelector('.admin-shell'); const nextShell = nextDocument.querySelector('.admin-shell');
    const currentMain = document.querySelector('main.workspace'); const nextMain = nextDocument.querySelector('main.workspace');
    const currentBar = document.querySelector('.workspace-bar'); const nextBar = nextDocument.querySelector('.workspace-bar');
    const update = () => {
      document.title = nextDocument.title || document.title;
      if (currentShell && nextShell && currentMain && nextMain) { if (currentBar && nextBar) currentBar.replaceWith(nextBar.cloneNode(true)); currentMain.replaceWith(nextMain.cloneNode(true)); }
      else document.body.innerHTML = nextDocument.body.innerHTML;
      syncNavigationState(url); syncNoExpiry(document);
    };
    if (typeof document.startViewTransition === 'function') document.startViewTransition(update); else update();
    if (historyMode === 'push') history.pushState({ rcAdmin:true, scrollY }, '', url.href);
    else if (historyMode === 'replace') history.replaceState({ rcAdmin:true, scrollY }, '', url.href);
    requestAnimationFrame(() => window.scrollTo({ top:scrollY, left:0, behavior:'instant' }));
    announce(`Loaded ${document.title.replace(/ \| RC IT Services Admin$/, '')}`);
  }

  function ensureDialog() {
    if (activeDialog && activeDialog.isConnected) return activeDialog;
    const dialog = document.createElement('dialog');
    dialog.className = 'rc-admin-dialog'; dialog.setAttribute('aria-labelledby','rc-admin-dialog-title');
    dialog.innerHTML = `<div class="rc-admin-dialog-shell"><header class="rc-admin-dialog-bar"><h2 id="rc-admin-dialog-title">Admin action</h2><button class="rc-admin-dialog-close" type="button" data-rc-modal-close aria-label="Close">×</button></header><div class="rc-admin-dialog-body"><div class="rc-admin-dialog-loading" role="status">Loading…</div></div></div>`;
    dialog.addEventListener('close', () => {
      const trigger = activeTrigger; const shouldRefresh = modalDirty && !skipCloseRefresh;
      activeDialog = null; activeTrigger = null; modalDirty = false; skipCloseRefresh = false; dialog.remove();
      if (trigger && trigger.isConnected) trigger.focus({ preventScroll:true });
      if (shouldRefresh) refreshCurrentView({ preserveScroll:true }).catch(() => {});
    });
    document.body.append(dialog); activeDialog = dialog; return dialog;
  }

  function renderModalError(message) {
    const dialog = ensureDialog(); const body = dialog.querySelector('.rc-admin-dialog-body'); const title = dialog.querySelector('#rc-admin-dialog-title');
    title.textContent = 'Unable to load action';
    body.innerHTML = `<div class="rc-admin-dialog-error" role="alert"><strong>The action could not be loaded.</strong><span>${message || 'Close this window and try again.'}</span></div>`;
    if (!dialog.open) dialog.showModal();
  }

  function renderModalDocument(nextDocument, url, trigger = null) {
    const dialog = ensureDialog(); const body = dialog.querySelector('.rc-admin-dialog-body'); const title = dialog.querySelector('#rc-admin-dialog-title');
    const workspace = nextDocument.querySelector('main.workspace'); const authCard = nextDocument.querySelector('.auth-card'); const source = workspace || authCard || nextDocument.querySelector('main#main-content');
    if (!source) throw new Error('Admin modal content unavailable');
    const heading = source.querySelector('h1'); title.textContent = heading?.textContent?.trim() || 'Admin action';
    body.innerHTML = workspace ? workspace.innerHTML : source.innerHTML; dialog.dataset.rcModalUrl = url.href;
    for (const link of body.querySelectorAll('a[href]')) {
      const target = sameOriginUrl(link.href);
      if (target && isDocumentPath(target.pathname)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; link.dataset.rcHardDocument = 'true'; }
    }
    if (trigger) activeTrigger = trigger;
    if (!dialog.open) dialog.showModal();
    body.scrollTop = 0; syncNoExpiry(body);
    requestAnimationFrame(() => dialog.querySelector('.rc-admin-dialog-close')?.focus({ preventScroll:true }));
    announce(`${title.textContent} opened`);
  }

  async function requestHtml(url, init = {}, controller = null) {
    const response = await fetch(url, { credentials:'same-origin', redirect:'follow', ...init, headers:{ accept:'text/html', 'x-rc-admin-soft-navigation':'1', ...(init.headers || {}) }, signal:controller?.signal });
    if (!isHtml(response)) throw new Error('Expected an HTML admin response');
    return { response, document:parseDocument(await response.text()), url:new URL(response.url || url, location.href) };
  }

  async function softNavigate(url, { historyMode='push', preserveScroll=false, restoreScroll=null } = {}) {
    if (!isSoftGetPath(url.pathname)) { location.assign(url.href); return; }
    rememberScroll(); navigationController?.abort(); navigationController = new AbortController(); setBusy(true);
    const targetScroll = restoreScroll == null ? (preserveScroll ? window.scrollY : 0) : restoreScroll;
    try {
      const result = await requestHtml(url.href, {}, navigationController);
      if (!isSoftGetPath(result.url.pathname) || isModalPath(result.url.pathname)) { location.assign(result.url.href); return; }
      if (activeDialog?.open) { skipCloseRefresh = true; activeDialog.close(); }
      applyTopLevelDocument(result.document,result.url,{ historyMode,scrollY:targetScroll });
    } catch (error) { if (error?.name !== 'AbortError') location.assign(url.href); }
    finally { setBusy(false); }
  }

  async function openModal(url, trigger = null, explicitModal = false) {
    modalController?.abort(); modalController = new AbortController();
    const dialog = ensureDialog(); const body = dialog.querySelector('.rc-admin-dialog-body'); body.innerHTML = '<div class="rc-admin-dialog-loading" role="status">Loading…</div>';
    if (trigger) activeTrigger = trigger; if (!dialog.open) dialog.showModal();
    try {
      const result = await requestHtml(url.href, {}, modalController);
      const modalDocument = Boolean(result.document.querySelector('main.workspace,.auth-card,main#main-content'));
      if (!explicitModal && !isModalPath(result.url.pathname)) { skipCloseRefresh = true; dialog.close(); await softNavigate(result.url,{historyMode:'replace'}); return; }
      if (!modalDocument) throw new Error('The server returned an incomplete admin action.');
      renderModalDocument(result.document,result.url,trigger);
    } catch (error) {
      if (error?.name !== 'AbortError') renderModalError('The current page was kept in place. Close this window and retry.');
    }
  }

  async function refreshCurrentView({ preserveScroll=true } = {}) {
    const url = new URL(location.href); if (!isSoftGetPath(url.pathname) || isModalPath(url.pathname)) return;
    const y = preserveScroll ? window.scrollY : 0; const result = await requestHtml(url.href); applyTopLevelDocument(result.document,url,{historyMode:'none',scrollY:y});
  }

  function formBody(form, submitter) {
    const params = new URLSearchParams(); const data = new FormData(form);
    if (submitter?.name && !data.has(submitter.name)) data.append(submitter.name,submitter.value || '');
    for (const [key,value] of data.entries()) if (typeof value === 'string') params.append(key,value);
    return params;
  }

  async function softSubmit(form, submitter) {
    const action = sameOriginUrl(form.action || location.href); if (!action) return;
    const method = (form.method || 'get').toLowerCase();
    if (method === 'get') { const params = formBody(form,submitter); action.search = params.toString(); await softNavigate(action,{historyMode:'push'}); return; }
    if (method !== 'post' || hardPostPaths.has(action.pathname) || !form.querySelector('input[name="csrf"]')) { form.requestSubmit(submitter || undefined); return; }
    const insideModal = Boolean(form.closest('.rc-admin-dialog')); const currentScroll = window.scrollY; const button = submitter instanceof HTMLElement ? submitter : null;
    if (button) button.setAttribute('disabled','disabled'); setBusy(true);
    try {
      const result = await requestHtml(action.href,{ method:'POST', body:formBody(form,submitter), headers:{ 'content-type':'application/x-www-form-urlencoded;charset=UTF-8', 'x-rc-admin-soft-submit':'1' } });
      const knownModalContent = Boolean(result.document.querySelector('#job-editor-title,#job-preview-title,.auth-card'));
      const modalRouteContent = isModalPath(result.url.pathname) && Boolean(result.document.querySelector('main.workspace,.auth-card,main#main-content'));
      const modalResponse = knownModalContent || modalRouteContent;
      if (insideModal && modalResponse) { modalDirty = true; renderModalDocument(result.document,result.url,activeTrigger); return; }
      if (insideModal) { modalDirty = false; skipCloseRefresh = true; activeDialog?.close(); await refreshCurrentView({preserveScroll:true}); return; }
      if (isModalPath(result.url.pathname)) { modalDirty = true; renderModalDocument(result.document,result.url,button || form); return; }
      if (result.url.pathname === location.pathname && location.pathname === '/jobs') { await refreshCurrentView({preserveScroll:true}); return; }
      applyTopLevelDocument(result.document,result.url,{historyMode:'replace',scrollY:result.url.pathname === location.pathname ? currentScroll : 0});
    } catch { if (insideModal) renderModalError('The current page was kept in place. Close this window and retry.'); else location.assign(action.href); }
    finally { if (button?.isConnected) button.removeAttribute('disabled'); setBusy(false); }
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof event.button === 'number' && event.button > 0) return;
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const close = target?.closest?.('[data-rc-modal-close]');
    if (close && activeDialog?.open) { event.preventDefault(); activeDialog.close(); return; }
    const link = target?.closest?.('a[href]'); if (!link || link.target || link.hasAttribute('download')) return;
    const url = sameOriginUrl(link.href); if (!url || (url.hash && url.pathname === location.pathname && url.search === location.search)) return;
    if (isDocumentPath(url.pathname)) return;
    if (activeDialog?.open && link.closest('.rc-admin-dialog') && topLevelPaths.has(url.pathname)) {
      event.preventDefault();
      if ((location.pathname === '/jobs' && url.pathname === '/jobs') || (location.pathname === '/applications' && url.pathname === '/applications')) activeDialog.close();
      else { skipCloseRefresh = true; activeDialog.close(); softNavigate(url,{historyMode:'push'}); }
      return;
    }
    const explicitModal = link.getAttribute('data-rc-admin-modal') === 'true';
    if (explicitModal || isModalPath(url.pathname)) { event.preventDefault(); openModal(url,link,explicitModal); return; }
    if (topLevelPaths.has(url.pathname)) { event.preventDefault(); softNavigate(url,{historyMode:'push'}); }
  }, { passive:false });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.name === 'no_expiry') syncNoExpiry(target.closest('form') || document);
  });

  document.addEventListener('submit', (event) => {
    if (event.defaultPrevented) return; const form = event.target; if (!(form instanceof HTMLFormElement)) return;
    const action = sameOriginUrl(form.action || location.href); if (!action) return; const method = (form.method || 'get').toLowerCase();
    if (method === 'get' && isSoftGetPath(action.pathname) && !isModalPath(action.pathname)) { event.preventDefault(); softSubmit(form,event.submitter).catch(()=>{}); return; }
    if (method === 'post' && !hardPostPaths.has(action.pathname) && form.querySelector('input[name="csrf"]')) { event.preventDefault(); softSubmit(form,event.submitter).catch(()=>{}); }
  });

  window.addEventListener('popstate', (event) => {
    if (activeDialog?.open) { skipCloseRefresh = true; activeDialog.close(); }
    const url = new URL(location.href); if (topLevelPaths.has(url.pathname)) softNavigate(url,{historyMode:'none',restoreScroll:Number(event.state?.scrollY || 0)});
  });

  history.replaceState({ ...(history.state || {}), rcAdmin:true, scrollY:window.scrollY }, '', location.href);
  syncNavigationState(new URL(location.href)); syncNoExpiry(document);
}

export const ADMIN_INTERACTION_SCRIPT = `(${rcAdminInteractionsBootstrap.toString()})();`;

export function injectAdminInteractionHtml(body = '') {
  if (!body || body.includes('data-rc-admin-interactions')) return body;
  if (!body.includes('</head>')) return body;
  return body.replace('</head>', `${ADMIN_INTERACTION_STYLE}<script src="${ADMIN_INTERACTION_PATH}" defer data-rc-admin-interactions></script></head>`);
}
