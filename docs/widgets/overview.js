import { TOWER_COLORS, towerColor, filterByGroup, helpToggle } from './utils.js';

let _pieChart = null;
let _barChart = null;

export function render({ apiConnections, scheduledJobs }, group) {
  const el = document.getElementById('tab-overview');
  const { api, sched } = filterByGroup(apiConnections, scheduledJobs, group);

  const proxyCount   = apiConnections.filter(r => r.group === 'api_proxy').length;
  const serviceCount = apiConnections.filter(r => r.group === 'api_service').length;
  const schedCount   = scheduledJobs.length;

  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">API Proxy</div>
        <div class="stat-value" style="color:var(--platform)">${proxyCount}</div>
        <div class="stat-sub">connections</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">API Service</div>
        <div class="stat-value" style="color:var(--standard)">${serviceCount}</div>
        <div class="stat-sub">connections</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Scheduled Jobs</div>
        <div class="stat-value" style="color:var(--drift)">${schedCount}</div>
        <div class="stat-sub">processes</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Entries</div>
        <div class="stat-value" style="color:var(--text)">${proxyCount + serviceCount + schedCount}</div>
        <div class="stat-sub">across all types</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="panel">
        <div class="panel-header-row">
          <div class="section-label" style="flex:1">Source Tower Distribution</div>
          <button class="help-btn" aria-expanded="false" aria-controls="help-pie">?</button>
        </div>
        <div id="help-pie" class="help-panel" hidden>
          <p>How many connections originate from each tower. A high count means that tower is a heavy data <em>producer</em> in the integration landscape.</p>
          <ul>
            <li>Filtered by the selected group (All / Proxy / Service / Scheduled).</li>
            <li>Only API connections have a Source Tower; scheduled jobs use Proposed Tower.</li>
          </ul>
        </div>
        <div style="position:relative;height:260px"><canvas id="chart-pie"></canvas></div>
      </div>

      <div class="panel">
        <div class="panel-header-row">
          <div class="section-label" style="flex:1">Tower Relationship Volume</div>
          <button class="help-btn" aria-expanded="false" aria-controls="help-bar">?</button>
        </div>
        <div id="help-bar" class="help-panel" hidden>
          <p>Total times each tower appears as either a source <em>or</em> a subscriber. Higher means a more central tower in the integration mesh.</p>
        </div>
        <div style="position:relative;height:260px"><canvas id="chart-bar"></canvas></div>
      </div>
    </div>`;

  helpToggle(el);
  _buildCharts(api, sched, group);
}

function _buildCharts(api, sched, group) {
  // Destroy previous chart instances to avoid canvas re-use errors
  if (_pieChart) { _pieChart.destroy(); _pieChart = null; }
  if (_barChart) { _barChart.destroy(); _barChart = null; }

  // Source tower counts
  const sourceCounts = {};
  api.forEach(r => {
    if (r.sourceTower) sourceCounts[r.sourceTower] = (sourceCounts[r.sourceTower] || 0) + 1;
  });
  if (group === 'all' || group === 'sched') {
    sched.forEach(r => r.proposedTowers.forEach(t => {
      sourceCounts[t] = (sourceCounts[t] || 0) + 1;
    }));
  }

  const pieLabels = Object.keys(sourceCounts).sort((a, b) => sourceCounts[b] - sourceCounts[a]);
  _pieChart = new Chart(document.getElementById('chart-pie'), {
    type: 'doughnut',
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieLabels.map(l => sourceCounts[l]),
        backgroundColor: pieLabels.map(l => towerColor(l)),
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

  // Combined source + subscriber volume
  const volCounts = {};
  api.forEach(r => {
    if (r.sourceTower)     volCounts[r.sourceTower]     = (volCounts[r.sourceTower]     || 0) + 1;
    if (r.subscriberTower) volCounts[r.subscriberTower] = (volCounts[r.subscriberTower] || 0) + 1;
  });
  sched.forEach(r => r.proposedTowers.forEach(t => {
    volCounts[t] = (volCounts[t] || 0) + 1;
  }));

  const barLabels = Object.keys(volCounts).sort((a, b) => volCounts[b] - volCounts[a]);
  _barChart = new Chart(document.getElementById('chart-bar'), {
    type: 'bar',
    data: {
      labels: barLabels,
      datasets: [{
        label: 'Connections',
        data: barLabels.map(l => volCounts[l]),
        backgroundColor: barLabels.map(l => towerColor(l) + 'CC'),
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
