import { esc } from './utils.js';

/**
 * Creates a sortable, filterable, paginated table inside `container`.
 *
 * columns: [{ key, label, sortable?, render?(row) }]
 * filterKeys: string[] — which keys the text filter searches
 * defaultSort: { key, dir }  dir: 1 = asc, -1 = desc
 */
export function createTable({ container, columns, pageSize = 10, filterKeys = [], defaultSort = null }) {
  let allRows      = [];
  let filteredRows = [];
  let sortKey = defaultSort?.key ?? null;
  let sortDir = defaultSort?.dir ?? -1;
  let page        = 0;
  let filterText  = '';

  container.innerHTML = `
    <div class="table-controls">
      <input class="table-filter" type="text" placeholder="Filter…" />
      <span class="table-count"></span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>${columns.map(c =>
          `<th${c.sortable ? ' class="sortable"' : ''} data-key="${c.key ?? ''}">${esc(c.label)}</th>`
        ).join('')}</tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="table-pagination">
      <button class="page-btn" id="prev-btn">‹ Prev</button>
      <span class="page-info"></span>
      <button class="page-btn" id="next-btn">Next ›</button>
    </div>`;

  const filterEl = container.querySelector('.table-filter');
  const countEl  = container.querySelector('.table-count');
  const tbody    = container.querySelector('tbody');
  const prevBtn  = container.querySelector('#prev-btn');
  const nextBtn  = container.querySelector('#next-btn');
  const pageInfo = container.querySelector('.page-info');
  const headers  = container.querySelectorAll('th.sortable');

  function _sort() {
    if (!sortKey) return;
    filteredRows.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const n  = typeof av === 'number' || typeof bv === 'number';
      const cmp = n ? (Number(av) - Number(bv)) : String(av ?? '').localeCompare(String(bv ?? ''));
      return cmp * sortDir;
    });
  }

  function _applyFilter() {
    const q = filterText.toLowerCase();
    filteredRows = q
      ? allRows.filter(row => filterKeys.some(k => String(row[k] ?? '').toLowerCase().includes(q)))
      : [...allRows];
    _sort();
    page = 0;
    _render();
  }

  function _render() {
    const total = filteredRows.length;
    const start = page * pageSize;
    const end   = Math.min(start + pageSize, total);
    const slice = filteredRows.slice(start, end);

    tbody.innerHTML = slice.length
      ? slice.map(row =>
          `<tr>${columns.map(c =>
            `<td>${c.render ? c.render(row) : esc(String(row[c.key] ?? ''))}</td>`
          ).join('')}</tr>`
        ).join('')
      : `<tr><td colspan="${columns.length}" style="text-align:center;color:var(--muted);padding:20px">No results</td></tr>`;

    const range = total ? `${start + 1}–${end} of ${total}` : '0 results';
    countEl.textContent  = range;
    pageInfo.textContent = total ? range : '';
    prevBtn.disabled     = page === 0;
    nextBtn.disabled     = end >= total;

    headers.forEach(th => {
      const key  = th.dataset.key;
      const col  = columns.find(c => c.key === key);
      const base = col?.label ?? '';
      th.textContent = key === sortKey ? `${base} ${sortDir === 1 ? '↑' : '↓'}` : base;
    });
  }

  filterEl.addEventListener('input', () => { filterText = filterEl.value; _applyFilter(); });
  prevBtn.addEventListener('click',  () => { if (page > 0) { page--; _render(); } });
  nextBtn.addEventListener('click',  () => {
    if ((page + 1) * pageSize < filteredRows.length) { page++; _render(); }
  });
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey === key) sortDir = -sortDir;
      else { sortKey = key; sortDir = -1; }
      _applyFilter();
    });
  });

  return {
    setData(rows) {
      allRows = rows;
      filterEl.value = '';
      filterText = '';
      _applyFilter();
    },
  };
}
