import { towerColor, towerChip, esc, helpToggle } from './utils.js';
import { createTable } from './table-helper.js';

let _pieChart = null;
let _barChart = null;
let _table    = null;

export function render({ apiConnections }) {
  const el = document.getElementById('tab-subscriber');

  if (_pieChart) { _pieChart.destroy(); _pieChart = null; }
  if (_barChart) { _barChart.destroy(); _barChart = null; }
  _table = null;

  el.innerHTML = `
    <div class="charts-row">
      <div class="panel">
        <div class="panel-header-row">
          <div class="section-label" style="flex:1">Subscriber Tower Distribution</div>
          <button class="help-btn" aria-expanded="false" aria-controls="help-sub-pie">?</button>
        </div>
        <div id="help-sub-pie" class="help-panel" hidden>
          <p>How many API integrations deliver data into each subscriber tower. A higher count means that tower consumes more data flows from Boomi.</p>
        </div>
        <div style="position:relative;height:240px"><canvas id="sub-chart-pie"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-header-row">
          <div class="section-label" style="flex:1">Subscriber Tower Volume</div>
          <button class="help-btn" aria-expanded="false" aria-controls="help-sub-bar">?</button>
        </div>
        <div id="help-sub-bar" class="help-panel" hidden>
          <p>Total integrations received by each subscriber tower, sorted by volume.</p>
        </div>
        <div style="position:relative;height:240px"><canvas id="sub-chart-bar"></canvas></div>
      </div>
    </div>

    <div class="panel">
      <div class="section-label">Subscriber Applications</div>
      <div id="sub-table"></div>
    </div>`;

  helpToggle(el);
  _buildCharts(apiConnections);
  _initTable(el, apiConnections);
}

function _buildCharts(apiConnections) {
  const counts = {};
  apiConnections.forEach(r => {
    if (r.subscriberTower) counts[r.subscriberTower] = (counts[r.subscriberTower] || 0) + 1;
  });

  const labels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  _pieChart = new Chart(document.getElementById('sub-chart-pie'), {
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

  _barChart = new Chart(document.getElementById('sub-chart-bar'), {
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

function _initTable(el, apiConnections) {
  const container = el.querySelector('#sub-table');
  if (!container) return;

  // Aggregate by subscriber app
  const map = {};
  apiConnections.forEach(r => {
    if (!r.subscriber) return;
    if (!map[r.subscriber]) {
      map[r.subscriber] = {
        subscriber:      r.subscriber,
        subscriberTower: r.subscriberTower || '',
        count:           0,
        sourceTowers:    new Set(),
      };
    }
    map[r.subscriber].count++;
    if (r.sourceTower) map[r.subscriber].sourceTowers.add(r.sourceTower);
  });

  const rows = Object.values(map).map(r => ({
    subscriber:       r.subscriber,
    subscriberTower:  r.subscriberTower,
    count:            r.count,
    _sourceTowerList: [...r.sourceTowers],
    _towerHtml:       towerChip(r.subscriberTower),
    _srcTowersHtml:   [...r.sourceTowers].map(t => towerChip(t)).join(' '),
  }));

  _table = createTable({
    container,
    filterKeys: ['subscriber', 'subscriberTower'],
    defaultSort: { key: 'subscriber', dir: 1 },
    columns: [
      { key: 'subscriber',      label: 'Subscriber App',  sortable: true },
      { key: '_towerHtml',      label: 'Tower',           render: r => r._towerHtml },
      { key: 'count',           label: '# Integrations',  sortable: true, render: r => String(r.count) },
      { key: '_srcTowersHtml',  label: 'Source Towers',   render: r => r._srcTowersHtml },
    ],
  });
  _table.setData(rows);
}
