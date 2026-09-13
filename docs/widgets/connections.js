import { towerChip, groupBadge, esc, filterByGroup } from './utils.js';
import { createTable } from './table-helper.js';

let _apiTable   = null;
let _schedTable = null;
let _lastGroup  = null;

export function render({ apiConnections, scheduledJobs }, group) {
  const el = document.getElementById('tab-connections');
  const { api, sched } = filterByGroup(apiConnections, scheduledJobs, group);

  // Re-render shell only when switching between modes that change visible tabs
  const showBoth  = group === 'all';
  const showApi   = group !== 'sched';
  const showSched = group === 'sched' || group === 'all';
  const modeKey   = showBoth ? 'both' : (showApi ? 'api' : 'sched');

  if (_lastGroup !== modeKey) {
    _lastGroup  = modeKey;
    _apiTable   = null;
    _schedTable = null;
    el.innerHTML = _buildShell(showApi, showSched, showBoth);
    _wireTabs(el);
    if (showApi)   _initApiTable(el);
    if (showSched) _initSchedTable(el);
  }

  // Push fresh data
  if (showApi && _apiTable) {
    _apiTable.setData(api.map(r => ({
      ...r,
      _group: r.group,
      _sourceTowerHtml:    towerChip(r.sourceTower),
      _subscriberHtml:     esc(r.subscriber),
      _subscriberTowerHtml: towerChip(r.subscriberTower),
    })));
  }
  if (showSched && _schedTable) {
    _schedTable.setData(sched.map(r => ({
      ...r,
      _envsHtml:   r.environments.map(e => `<span class="badge badge-sched">${esc(e)}</span>`).join(' '),
      _towersHtml: r.proposedTowers.map(t => towerChip(t)).join(' '),
      _connStr:    r.connectors.join(', '),
    })));
  }
}

function _buildShell(showApi, showSched, showBoth) {
  const tabs = showBoth ? `
    <div class="panel-header-row" style="margin-bottom:10px">
      <button class="group-btn active" data-subtab="api"   style="margin-right:6px">API Connections</button>
      <button class="group-btn"        data-subtab="sched">Scheduled Jobs</button>
    </div>` : '';

  return `
    <div class="panel">
      ${tabs}
      ${showApi   ? `<div id="api-table-container"   class="${showBoth ? '' : ''}"></div>` : ''}
      ${showSched ? `<div id="sched-table-container" class="${showBoth ? 'hidden' : ''}"></div>` : ''}
    </div>`;
}

function _wireTabs(el) {
  el.querySelectorAll('[data-subtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-subtab]').forEach(b => b.classList.toggle('active', b === btn));
      const showApi = btn.dataset.subtab === 'api';
      const apiC    = el.querySelector('#api-table-container');
      const schedC  = el.querySelector('#sched-table-container');
      if (apiC)   apiC.classList.toggle('hidden',  !showApi);
      if (schedC) schedC.classList.toggle('hidden',  showApi);
    });
  });
}

function _initApiTable(el) {
  const container = el.querySelector('#api-table-container');
  if (!container) return;
  _apiTable = createTable({
    container,
    filterKeys: ['name', 'subscriber', 'sourceTower', 'subscriberTower'],
    defaultSort: { key: 'name', dir: 1 },
    columns: [
      { key: '_group',            label: 'Group',           render: r => groupBadge(r._group) },
      { key: 'name',              label: 'Component Name',  sortable: true },
      { key: '_sourceTowerHtml',  label: 'Source Tower',    render: r => r._sourceTowerHtml },
      { key: '_subscriberHtml',   label: 'Subscriber',      render: r => r._subscriberHtml },
      { key: '_subscriberTowerHtml', label: 'Subscriber Tower', render: r => r._subscriberTowerHtml },
    ],
  });
}

function _initSchedTable(el) {
  const container = el.querySelector('#sched-table-container');
  if (!container) return;
  _schedTable = createTable({
    container,
    filterKeys: ['processName', '_connStr'],
    defaultSort: { key: 'processName', dir: 1 },
    columns: [
      { key: 'processName', label: 'Process Name', sortable: true },
      { key: '_envsHtml',   label: 'Environments', render: r => r._envsHtml },
      { key: '_connStr',    label: 'Connectors',   render: r => `<span style="font-size:12px;color:var(--muted)">${esc(r._connStr)}</span>` },
      { key: '_towersHtml', label: 'Proposed Towers', render: r => r._towersHtml },
    ],
  });
}
