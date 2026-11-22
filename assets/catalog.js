(() => {
  const search = document.querySelector('#search');
  const market = document.querySelector('#market');
  const sector = document.querySelector('#sector');
  const groupBy = document.querySelector('#group-by');
  const rangeButtons = [...document.querySelectorAll('[data-scope]')];
  const groups = [...document.querySelectorAll('.sector[data-group]')];
  const grids = {date: new Map(), market: new Map(), sector: new Map()};
  for (const group of groups) {
    grids[group.dataset.view].set(group.dataset.group, group.querySelector('.asset-grid'));
  }
  const cards = [...document.querySelectorAll('.asset-card')].sort((a, b) =>
    (b.dataset.updated || b.dataset.date).localeCompare(a.dataset.updated || a.dataset.date)
    || (b.dataset.edition || b.dataset.date).localeCompare(a.dataset.edition || a.dataset.date)
    || a.dataset.ticker.localeCompare(b.dataset.ticker));
  const empty = document.querySelector('#empty');
  const expand = document.querySelector('#expand-scope');
  const clear = document.querySelector('#clear-filters');
  const result = document.querySelector('#result-count');
  const reportRoot = new URL('./', location.href);
  const returnKey = 'report-directory-return:' + reportRoot.pathname;
  const shanghaiDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  let scope = 'recent';
  let scopeBeforeSearch = 'recent';
  let rendered = '';

  function dateGroup(stamp, today) {
    // 仅记到月份的旧报告归入全部归档，避免将其猜为月初或月末。
    if (stamp.length !== 10) return 'older';
    const age = (today - Date.parse(stamp)) / 86400000;
    if (age >= 0 && age < 7) return 'week';
    if (age >= 7 && age < 30) return 'month';
    return 'older';
  }

  function draw() {
    const today = Date.parse(shanghaiDate.format(new Date()));
    const view = groupBy.value;
    const layout = view + today;
    const counts = new Map();
    const query = search.value.trim().toLowerCase();
    let total = 0;
    for (const card of cards) {
      const data = card.dataset;
      const period = dateGroup(data.date, today);
      const key = view === 'date' ? period : data[view];
      if (rendered !== layout) grids[view].get(key).append(card);
      card.hidden = (scope === 'recent' && period === 'older')
        || (market.value !== '' && market.value !== data.market)
        || (sector.value !== '' && sector.value !== data.sector)
        || ![data.ticker, data.name, data.sector].some(s => s.toLowerCase().includes(query));
      if (!card.hidden) {
        counts.set(key, (counts.get(key) || 0) + 1);
        total++;
      }
    }
    rendered = layout;
    for (const group of groups) {
      const count = counts.get(group.dataset.group) || 0;
      group.hidden = view !== group.dataset.view || count === 0;
      if (!group.hidden) group.querySelector('h2 small').textContent = count + ' 项';
    }
    for (const button of rangeButtons) button.setAttribute('aria-pressed', String(scope === button.dataset.scope));
    result.textContent = total + ' 项';
    empty.hidden = total !== 0;
    expand.hidden = scope === 'all';
    clear.hidden = !search.value && !sector.value && !market.value;
    empty.querySelector('p').textContent = scope === 'all'
      ? '试试其他名称、代码或筛选条件。' : '近 30 天没有符合条件的更新，可查看更早的归档。';
  }

  function readFilters(params) {
    search.value = params.get('q') || '';
    const defaultScope = search.value ? 'all' : 'recent';
    scope = ['all', 'recent'].includes(params.get('scope')) ? params.get('scope') : defaultScope;
    for (const [select, key, fallback] of [[market, 'market', ''], [sector, 'sector', ''], [groupBy, 'group', 'date']]) {
      const value = params.get(key);
      select.value = [...select.options].some(option => option.value === value) ? value : fallback;
    }
  }

  function saveFilters() {
    const url = new URL(location.href);
    const defaultScope = search.value ? 'all' : 'recent';
    const values = {q: search.value, market: market.value, sector: sector.value,
      scope: scope === defaultScope ? '' : scope, group: groupBy.value === 'date' ? '' : groupBy.value};
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.hash === '#comparisons') url.hash = '';
    history.replaceState(history.state, '', url);
  }

  function apply() {
    draw();
    saveFilters();
  }
  function showAll() {
    scope = 'all';
    apply();
  }

  let hadSearch = false;
  search.addEventListener('input', () => {
    const hasSearch = Boolean(search.value.trim());
    if (hasSearch && !hadSearch) {
      scopeBeforeSearch = scope;
      scope = 'all';
    } else if (!hasSearch && hadSearch) {
      scope = scopeBeforeSearch;
    }
    hadSearch = hasSearch;
    apply();
  });
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) search.blur();
  });
  for (const select of [market, sector, groupBy]) select.addEventListener('change', apply);
  for (const btn of rangeButtons) btn.addEventListener('click', () => { scope = btn.dataset.scope; apply(); });
  expand.addEventListener('click', showAll);
  clear.addEventListener('click', () => {
    search.value = market.value = sector.value = '';
    hadSearch = false;
    apply();
    search.focus();
  });
  for (const link of document.querySelectorAll('[data-jump]')) link.addEventListener('click', event => {
    event.preventDefault();
    const compare = link.dataset.jump === 'comparisons';
    readFilters(new URLSearchParams(compare ? {market: '对比', scope: 'all', group: 'market'} : {}));
    hadSearch = false;
    apply();
    document.querySelector('#directory').scrollIntoView({block: 'start'});
  });

  function position() {
    return {y: window.scrollY, scopeBeforeSearch, open: cards.filter(card =>
      card.querySelector('.history').open).map(card => card.dataset.ticker)};
  }
  function restore(saved) {
    if (!saved) return;
    for (const card of cards) card.querySelector('.history').open = saved.open.includes(card.dataset.ticker);
    scopeBeforeSearch = saved.scopeBeforeSearch;
    requestAnimationFrame(() => window.scrollTo(0, saved.y));
  }
  function reportUrl(url) {
    return url.origin === reportRoot.origin && ['reports/', 'sources/'].some(prefix =>
      url.pathname.startsWith(reportRoot.pathname + prefix));
  }
  // 记录离开目录时的视口；内页的归档首页链接和浏览器后退均可回到原位。
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
      || link.target || !reportUrl(new URL(link.href))) return;
    const saved = position();
    history.replaceState({...history.state, catalog: saved}, '');
    try {
      sessionStorage.setItem(returnKey, JSON.stringify({query: location.search, saved}));
    } catch { /* 禁用存储时，浏览器后退仍由 history.state 恢复。 */ }
  });
  window.addEventListener('pagehide', () => {
    history.replaceState({...history.state, catalog: position()}, '');
  });
  const params = new URLSearchParams(location.search);
  let saved = history.state?.catalog;
  try {
    const pending = JSON.parse(sessionStorage.getItem(returnKey));
    sessionStorage.removeItem(returnKey);
    const previous = window.navigation?.activation?.from?.url || document.referrer;
    if (pending && !saved && !params.size && !location.hash && (!previous || reportUrl(new URL(previous)))) {
      readFilters(new URLSearchParams(pending.query));
      saveFilters();
      saved = pending.saved;
    } else {
      readFilters(params);
    }
  } catch {
    readFilters(params);
  }
  if (!params.size && location.hash === '#comparisons') {
    readFilters(new URLSearchParams({market: '对比', scope: 'all', group: 'market'}));
  }
  hadSearch = Boolean(search.value.trim());
  draw();
  restore(saved);
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      draw();
      restore(history.state?.catalog);
      try { sessionStorage.removeItem(returnKey); } catch { /* 禁用存储。 */ }
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) draw(); });
})();
