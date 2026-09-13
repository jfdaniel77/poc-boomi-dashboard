import { TOWER_COLORS, towerColor, towerChip, groupBadge, esc, helpToggle } from './utils.js';
import { createTable } from './table-helper.js';

let _pieChart  = null;
let _barChart  = null;
let _apiTable  = null;
let _schedTable = null;

export function render({ apiConnections, scheduledJobs }) {
  const el = document.getElementById('tab-source');

  if (_pieChart)  { _pieChart.destroy();  _pieChart  = null; }
  if (_barChart)  { _barChart.destroy();  _barChart  = null; }
  _apiTable   = null;
  _schedTable = null;

  el.innerHTML = `
    <div class="charts-row">
      <div class="panel">
        <div class="panel-header-row">
          <div class="section-label" style="flex:1">Source Tower Distribution</div>
          <button class="help-btn" aria-expanded="false" aria-controls="help-src-pie">?</button>
        </div>
        <div id="help-src-pie" class="help-panel" hidden>
          <p>How many API integrations originate from each source tower. A higher count means that tower produces more data flows through Boomi.</p>
        </div>
        <div style="position:relative;height:240px"><canvas id="src-chart-pie"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-header-row">
          <div class="section-label" style="flex:1">Source Tower Volume</div>
          <button class="help-btn" aria-expanded="false" aria-controls="help-src-bar">?</button>
        </div>
        <div id="help-src-bar" class="help-panel" hidden>
          <p>Total integrations originating from each source tower, sorted by volume.</p>
        </div>
        <div style="position:relative;height:240px"><canvas id="src-chart-bar"></canvas></div>
      </div>
    </div>

    <div class="panel">
      <div class="section-label">API Integrations</div>
      <div id="src-api-table"></div>
    </div>

    <div class="panel">
      <div class="section-label">Scheduled Jobs</div>
      <div id="src-sched-table"></div>
    </div>`;

  helpToggle(el);
  _buildCharts(apiConnections);
  _initApiTable(el, apiConnections);
  _initSchedTable(el, scheduledJobs);
}

function _buildCharts(apiConnections) {
  const counts = {};
  apiConnections.forEach(r => {
    if (r.sourceTower) counts[r.sourceTower] = (counts[r.sourceTower] || 0) + 1;
  });

  const labels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  _pieChart = new Chart(document.getElementById('src-chart-pie'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: labels.map(l => counts[l]),
        backgroundColor: labels.map(l => towerColor(l)),
        borderWidth: 2,
        borderColor: '#EDEBE4',
      }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 }, color: '#6b6760' } },
      },
    },
  });

  _barChart = new Chart(document.getElementById('src-chart-bar'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Integrations',
        data: labels.map(l => counts[l]),
        backgroundColor: labels.map(l => towerColor(l) + 'CC'),
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#CCCAC4' }, ticks: { color: '#6b6760', font: { size: 11 } } },
        y: { grid: { display: false },   ticks: { color: '#55514b', font: { size: 10 } } },
      },
    },
  });
}

function _initApiTable(el, apiConnections) {
  const container = el.querySelector('#src-api-table');
  if (!container) return;
  _apiTable = createTable({
    container,
    filterKeys: ['name', 'sourceTower', 'subscriber', 'subscriberTower'],
    defaultSort: { key: 'name', dir: 1 },
    columns: [
      { key: '_group',             label: 'Type',             render: r => groupBadge(r._group) },
      { key: 'name',               label: 'Process Name',     sortable: true },
      { key: '_sourceTowerHtml',   label: 'Source Tower',     render: r => r._sourceTowerHtml },
      { key: '_subscriberHtml',    label: 'Subscriber',       render: r => r._subscriberHtml },
      { key: '_subTowerHtml',      label: 'Subscriber Tower', render: r => r._subTowerHtml },
    ],
  });
  _apiTable.setData(apiConnections.map(r => ({
    ...r,
    _group:           r.group,
    _sourceTowerHtml: towerChip(r.sourceTower),
    _subscriberHtml:  esc(r.subscriber),
    _subTowerHtml:    towerChip(r.subscriberTower),
  })));
}

function _initSchedTable(el, scheduledJobs) {
  const container = el.querySelector('#src-sched-table');
  if (!container) return;
  _schedTable = createTable({
    container,
    filterKeys: ['processName', '_connStr'],
    defaultSort: { key: 'processName', dir: 1 },
    columns: [
      { key: 'processName', label: 'Process Name',    sortable: true },
      { key: '_envsHtml',   label: 'Environments',    render: r => r._envsHtml },
      { key: '_connStr',    label: 'Connectors',      render: r => `<span style="font-size:12px;color:var(--muted)">${esc(r._connStr)}</span>` },
      { key: '_towersHtml', label: 'Proposed Towers', render: r => r._towersHtml },
    ],
  });
  _schedTable.setData(scheduledJobs.map(r => ({
    ...r,
    _envsHtml:   r.environments.map(e => `<span class="badge badge-sched">${esc(e)}</span>`).join(' '),
    _connStr:    r.connectors.join(', '),
    _towersHtml: r.proposedTowers.map(t => towerChip(t)).join(' '),
  })));
}
