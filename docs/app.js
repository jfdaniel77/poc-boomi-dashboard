import { render as renderOverview }    from './widgets/overview.js';
import { render as renderConnections } from './widgets/connections.js';
import { render as renderTopology }    from './widgets/topology.js';

const TABS = [
  { id: 'overview',    render: renderOverview },
  { id: 'connections', render: renderConnections },
  { id: 'topology',    render: renderTopology },
];

let gApiConnections = [];
let gScheduledJobs  = [];
let currentGroup    = 'all';
let currentTab      = 'overview';

function _activateTab() {
  const tab = TABS.find(t => t.id === currentTab);
  if (tab) tab.render({ apiConnections: gApiConnections, scheduledJobs: gScheduledJobs }, currentGroup);
}

function _buildTabBar() {
  document.querySelectorAll('#tab-bar .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('#tab-bar .tab-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `tab-${currentTab}`);
      });
      _activateTab();
    });
  });
}

function _wireGroupSelector() {
  document.querySelectorAll('.group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentGroup = btn.dataset.group;
      document.querySelectorAll('.group-btn').forEach(b => b.classList.toggle('active', b === btn));
      _activateTab();
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  _buildTabBar();
  _wireGroupSelector();

  try {
    const [apiRes, schedRes] = await Promise.all([
      fetch('./data/api-connections.json'),
      fetch('./data/scheduled-jobs.json'),
    ]);
    gApiConnections = await apiRes.json();
    gScheduledJobs  = await schedRes.json();

    const ts = new Date().toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short',
    });
    document.getElementById('data-timestamp').textContent = `Data as of ${ts}`;
  } catch {
    document.querySelector('.tab-panel.active').innerHTML = `
      <div class="panel" style="border-left:4px solid var(--critical)">
        <strong style="color:var(--critical)">Data not found.</strong>
        Run <code>node scripts/parse-data.js</code> (or via the nodejs Docker container) to generate the JSON files, then refresh.
      </div>`;
    return;
  }

  _activateTab();
});
