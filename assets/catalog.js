(() => {
  const search = document.querySelector('#search');
  const selectors = {market: document.querySelector('#market'), sector: document.querySelector('#sector')};
  const filters = [...document.querySelectorAll('[data-filter]')];
  const sorters = [...document.querySelectorAll('[data-sort]')];
  const groups = [...document.querySelectorAll('.sector[data-group]')];
  const cards = [...document.querySelectorAll('.asset-card')];
  const ranked = document.querySelector('#ranked');
  const containers = { market: new Map(), sector: new Map() };
  for (const group of groups) {
    containers[group.dataset.view].set(group.dataset.group, group.querySelector('.asset-grid'));
  }
  let browse = 'market';
  let sort = 'market';
  let renderedView = 'market';

  function byDate(a, b) {
    return b.dataset.date.localeCompare(a.dataset.date) || a.dataset.ticker.localeCompare(b.dataset.ticker);
  }

  function draw() {
    if (sort === 'market' || sort === 'sector') browse = sort;
    document.querySelector('#browse-dimension').textContent = browse === 'market' ? '浏览市场' : '浏览板块';
    for (const group of document.querySelectorAll('[data-filters]')) group.hidden = group.dataset.filters !== browse;
    selectors.market.hidden = browse === 'market';
    selectors.sector.hidden = browse === 'sector';
    const market = selectors.market.value;
    const sector = selectors.sector.value;
    const query = search.value.trim().toLocaleLowerCase();
    const visible = cards.filter(card => {
      const data = card.dataset;
      const match = (!sector || data.sector === sector) && (!market || data.market === market)
        && [data.ticker, data.name, data.sector].some(value => value.toLocaleLowerCase().includes(query));
      card.hidden = !match;
      return match;
    });

    for (const btn of filters) btn.setAttribute('aria-pressed', btn.dataset.filter === selectors[btn.dataset.filterBy].value);
    for (const btn of sorters) btn.setAttribute('aria-pressed', btn.dataset.sort === sort);
    document.querySelector('#heat-note').hidden = sort !== 'heat';
    for (const card of cards) card.querySelector('.card-heat').hidden = sort !== 'heat';
    const grouped = sort === 'market' || sort === 'sector';
    document.querySelector('#groups').hidden = !grouped;
    ranked.hidden = grouped;
    if (grouped) {
      if (renderedView !== sort) {
        for (const card of [...cards].sort(byDate)) {
          containers[sort].get(card.dataset[sort]).append(card);
        }
      }
      for (const group of groups) {
        const count = group.querySelectorAll('.asset-card:not([hidden])').length;
        group.hidden = group.dataset.view !== sort || count === 0;
        group.querySelector('h2 small').textContent = count + ' 项';
      }
    } else {
      visible.sort((a, b) => (sort === 'heat' ? Number(b.dataset.heat) - Number(a.dataset.heat) : 0)
        || byDate(a, b));
      ranked.append(...visible);
    }
    renderedView = sort;
    document.querySelector('#result-count').textContent = visible.length + ' 项';
    document.querySelector('#empty').hidden = visible.length !== 0;
  }

  function reset(nextMarket = '') {
    search.value = '';
    selectors.market.value = nextMarket;
    selectors.sector.value = '';
    draw();
  }

  filters.forEach(btn => btn.addEventListener('click', () => {
    selectors[btn.dataset.filterBy].value = btn.dataset.filter; draw();
  }));
  sorters.forEach(btn => btn.addEventListener('click', () => { sort = btn.dataset.sort; draw(); }));
  search.addEventListener('input', draw);
  for (const select of Object.values(selectors)) select.addEventListener('change', draw);
  document.querySelector('#clear-filters').addEventListener('click', () => { reset(); search.focus(); });
  document.querySelectorAll('[data-jump]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    sort = 'market';
    reset(link.dataset.jump ? '对比' : '');
    document.querySelector('#directory').scrollIntoView({block: 'start'});
  }));
  if (location.hash === '#comparisons') reset('对比');
})();
