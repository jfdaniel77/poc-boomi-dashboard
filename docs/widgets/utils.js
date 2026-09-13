export const TOWER_COLORS = {
  'Architecture, Application and Technology (AAT)': '#5E7A89',
  'Student Systems (SS)':                           '#8AA678',
  'Corporate Systems (CS)':                         '#C98A3C',
  'Faculty and Research Systems (FRS)':             '#7B68AE',
  'Enterprise Systems (ES)':                        '#9A6B4F',
  'External Parties':                               '#9CA3AF',
  'IT Security':                                    '#B5524A',
  'HR and Finance Systems':                         '#B09A5C',
  'Infrastructure':                                 '#6B7D6A',
  'Others (NUS Departments)':                       '#7A8B9A',
};

export function towerColor(tower) {
  return TOWER_COLORS[tower] || '#CCCAC4';
}

export function towerChip(tower) {
  if (!tower) return `<span style="color:var(--muted)">—</span>`;
  const c = towerColor(tower);
  return `<span class="tower-chip" style="background:${c}22;color:${c}">${esc(tower)}</span>`;
}

export function groupBadge(group) {
  if (group === 'api_proxy')   return `<span class="badge badge-proxy">proxy</span>`;
  if (group === 'api_service') return `<span class="badge badge-service">service</span>`;
  return `<span class="badge badge-sched">sched</span>`;
}

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Returns { api, sched } filtered by the current group selection.
export function filterByGroup(apiConnections, scheduledJobs, group) {
  if (group === 'proxy')   return { api: apiConnections.filter(r => r.group === 'api_proxy'),   sched: [] };
  if (group === 'service') return { api: apiConnections.filter(r => r.group === 'api_service'), sched: [] };
  if (group === 'sched')   return { api: [], sched: scheduledJobs };
  return { api: apiConnections, sched: scheduledJobs };
}

export function helpToggle(el) {
  el.querySelectorAll('.help-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      const open  = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
  });
}
