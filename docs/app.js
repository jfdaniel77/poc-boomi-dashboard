import { render as renderOverview }    from './widgets/overview.js';
import { render as renderSource }      from './widgets/source.js';
import { render as renderSubscriber }  from './widgets/subscriber.js';
import { render as renderTopology }    from './widgets/topology.js';

const TABS = [
  { id: 'overview',   render: renderOverview },
  { id: 'source',     render: renderSource },
  { id: 'subscriber', render: renderSubscriber },
  { id: 'topology',   render: renderTopology },
];

let gData      = null;
let currentTab = 'overview';

function _activateTab() {
  const tab = TABS.find(t => t.id === currentTab);
  if (tab && gData) tab.render(gData);
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

document.addEventListener('DOMContentLoaded', async () => {
  _buildTabBar();

  try {
    const [apiRes, schedRes] = await Promise.all([
      fetch('./data/api-connections.json'),
      fetch('./data/scheduled-jobs.json'),
    ]);
    gData = {
      apiConnections: await apiRes.json(),
      scheduledJobs:  await schedRes.json(),
    };

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
