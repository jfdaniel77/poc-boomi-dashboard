export function render({ apiConnections, scheduledJobs }) {
  const el = document.getElementById('tab-overview');

  const proxyCount   = apiConnections.filter(r => r.group === 'api_proxy').length;
  const serviceCount = apiConnections.filter(r => r.group === 'api_service').length;
  const schedCount   = scheduledJobs.length;
  const total        = proxyCount + serviceCount + schedCount;

  // Unique towers across all data
  const allTowers = new Set();
  apiConnections.forEach(r => {
    if (r.sourceTower)     allTowers.add(r.sourceTower);
    if (r.subscriberTower) allTowers.add(r.subscriberTower);
  });
  scheduledJobs.forEach(r => r.proposedTowers?.forEach(t => allTowers.add(t)));

  // Unique subscriber application names
  const subscriberApps = new Set(apiConnections.map(r => r.subscriber).filter(Boolean));

  el.innerHTML = `
    <div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))">
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
        <div class="stat-label">Total</div>
        <div class="stat-value" style="color:var(--text)">${total}</div>
        <div class="stat-sub">across all types</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Towers</div>
        <div class="stat-value" style="color:var(--elevated)">${allTowers.size}</div>
        <div class="stat-sub">integration towers</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Applications</div>
        <div class="stat-value" style="color:var(--drift)">${subscriberApps.size}</div>
        <div class="stat-sub">subscriber apps</div>
      </div>
    </div>`;
}
