import { TOWER_COLORS, towerColor, esc, filterByGroup, helpToggle } from './utils.js';

const HUB_ID    = '__boomi__';
const HUB_COLOR = '#5E7A89';   // --platform

let _state = { sim: null, nodeSel: null, linkSel: null, labelSel: null, nodeCache: new Map() };
let _allConnections = [];
let _selectedTower  = null;

export function render({ apiConnections, scheduledJobs }, group) {
  const el = document.getElementById('tab-topology');

  // Topology only uses API connections (proxy + service have source/subscriber towers)
  const { api } = filterByGroup(apiConnections, scheduledJobs, group);
  _allConnections = api.length ? api : apiConnections; // fall back to all if group='sched'

  const note = (group === 'sched')
    ? `<div class="panel" style="border-left:4px solid var(--elevated);margin-bottom:0">
         <strong style="color:var(--elevated)">Note:</strong> The topology shows API connections (proxy + service).
         Scheduled jobs do not have Source / Subscriber towers and are not shown here.
       </div>`
    : '';

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header-row">
        <div class="section-label" style="flex:1">Integration Source Topology</div>
        <button class="help-btn" aria-expanded="false" aria-controls="help-topo">?</button>
      </div>
      <div id="help-topo" class="help-panel" hidden>
        <p>Each node is a tower. The hub at the centre represents the Boomi platform. An edge between two towers means connections exist between them through Boomi. Edge thickness = number of connections.</p>
        <ul>
          <li>Click a tower to see all its inbound and outbound connections.</li>
          <li>Drag nodes to reposition. Scroll or pinch to zoom.</li>
          <li>Click the background or <em>Clear</em> to reset the highlight.</li>
        </ul>
      </div>

      ${note}

      <svg id="topo-svg" class="topo-svg" aria-label="Integration topology graph" style="height:480px"></svg>
      <div id="node-detail" style="display:none"></div>
    </div>`;

  helpToggle(el);
  _buildGraph();
}

// ── Graph construction ────────────────────────────────────────────────────────

function _buildGraph() {
  const connections = _allConnections;
  if (!connections.length) return;

  // Aggregate tower-to-tower edges
  const edgeMap = {};
  const degree  = {};

  connections.forEach(({ sourceTower: s, subscriberTower: t }) => {
    if (!s || !t || s === t) return;
    const key = `${s}|||${t}`;
    edgeMap[key] = (edgeMap[key] || 0) + 1;
    degree[s] = (degree[s] || 0) + 1;
    degree[t] = (degree[t] || 0) + 1;
  });

  // Build node list (hub + towers)
  const towerIds = new Set();
  Object.keys(edgeMap).forEach(k => k.split('|||').forEach(id => towerIds.add(id)));

  const maxDeg = Math.max(...Object.values(degree), 1);

  const nodes = [
    { id: HUB_ID, label: 'Boomi\nPlatform', color: HUB_COLOR, r: 22, hub: true, fx: null, fy: null },
    ...[...towerIds].map(id => {
      const cached = _state.nodeCache.get(id);
      return {
        id, label: _abbrev(id), color: towerColor(id),
        r: 9 + Math.sqrt((degree[id] || 1) / maxDeg) * 18,
        hub: false,
        x: cached?.x, y: cached?.y,
      };
    }),
  ];

  // Links: tower→hub + tower↔tower
  const links = [
    ...[...towerIds].map(id => ({ source: HUB_ID, target: id, count: 0, hub: true })),
    ...Object.entries(edgeMap).map(([key, count]) => {
      const [source, target] = key.split('|||');
      return { source, target, count, hub: false };
    }),
  ];

  const maxCount = Math.max(...links.filter(l => !l.hub).map(l => l.count), 1);

  // ── SVG setup ────────────────────────────────────────────────────────────

  const svgEl = document.getElementById('topo-svg');
  const W = svgEl.clientWidth  || 820;
  const H = svgEl.clientHeight || 480;

  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  svg.selectAll('*').remove();

  // Pin hub at centre
  nodes[0].fx = W / 2;
  nodes[0].fy = H / 2;

  const zoom = d3.zoom().scaleExtent([0.3, 3]).on('zoom', e => g.attr('transform', e.transform));
  svg.call(zoom);
  svg.on('click', () => _clearDetail());

  const g = svg.append('g');

  // Arrow marker (for directed tower-to-tower links)
  svg.append('defs').append('marker')
    .attr('id', 'arrow').attr('viewBox', '0 -4 8 8')
    .attr('refX', 20).attr('refY', 0)
    .attr('markerWidth', 5).attr('markerHeight', 5)
    .attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#CCCAC4');

  // Links
  const linkG = g.append('g');
  _state.linkSel = linkG.selectAll('line')
    .data(links).join('line')
    .attr('class', 'topo-link')
    .attr('stroke-width', d => d.hub ? 0.8 : 1 + (d.count / maxCount) * 5)
    .attr('stroke-dasharray', d => d.hub ? '3,4' : null)
    .attr('marker-end', d => d.hub ? null : 'url(#arrow)');

  // Edge count labels (non-hub links only)
  _state.labelSel = g.append('g').selectAll('text')
    .data(links.filter(l => !l.hub)).join('text')
    .attr('text-anchor', 'middle').attr('font-size', 9)
    .attr('fill', '#9CA3AF').attr('pointer-events', 'none')
    .text(d => d.count);

  // Nodes
  _state.nodeSel = g.append('g').selectAll('g')
    .data(nodes).join('g')
    .attr('class', 'topo-node')
    .style('cursor', d => d.hub ? 'default' : 'pointer')
    .on('click', (event, d) => {
      if (d.hub) return;
      event.stopPropagation();
      _selectedTower === d.id ? _clearDetail() : _showDetail(d, connections);
    })
    .call(d3.drag()
      .on('start', (ev, d) => { if (!d.hub && !ev.active) _state.sim?.alphaTarget(0.3).restart(); if (!d.hub) { d.fx = d.x; d.fy = d.y; } })
      .on('drag',  (ev, d) => { if (!d.hub) { d.fx = ev.x; d.fy = ev.y; } })
      .on('end',   (ev, d) => { if (!d.hub && !ev.active) _state.sim?.alphaTarget(0); if (!d.hub) { d.fx = null; d.fy = null; } })
    );

  _state.nodeSel.append('circle').attr('r', d => d.r).attr('fill', d => d.color);

  // Wrapped label (two lines for hub; abbrev for towers)
  _state.nodeSel.each(function(d) {
    const node = d3.select(this);
    if (d.hub) {
      const lines = d.label.split('\n');
      lines.forEach((line, i) => {
        node.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', `${d.r + 13 + i * 13}px`)
          .attr('font-size', 11).attr('font-weight', 700)
          .attr('fill', HUB_COLOR).text(line);
      });
    } else {
      node.append('text').attr('text-anchor', 'middle').attr('dy', d => `${d.r + 12}px`).text(d.label);
    }
  });

  _state.nodeSel.append('title').text(d => d.hub ? 'Boomi Platform' : `${d.id}\n${degree[d.id] || 0} connections`);

  // Force simulation
  if (_state.sim) _state.sim.stop();
  _state.sim = d3.forceSimulation(nodes)
    .force('link',      d3.forceLink(links).id(d => d.id).distance(d => d.hub ? 130 : 200).strength(0.4))
    .force('charge',    d3.forceManyBody().strength(-400))
    .force('center',    d3.forceCenter(W / 2, H / 2).strength(0.05))
    .force('collision', d3.forceCollide().radius(d => d.r + 18))
    .on('tick', () => {
      _state.linkSel
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      _state.labelSel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2 - 5);
      _state.nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    })
    .on('end', () => {
      // Cache positions for stable re-renders
      nodes.forEach(n => { if (!n.hub) _state.nodeCache.set(n.id, { x: n.x, y: n.y }); });
    });

  window.addEventListener('resize', _debounce(() => render(
    { apiConnections: _allConnections, scheduledJobs: [] }, 'all'
  ), 300), { once: true });
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function _showDetail(d, connections) {
  _selectedTower = d.id;

  const asSource = connections.filter(r => r.sourceTower === d.id);
  const asSub    = connections.filter(r => r.subscriberTower === d.id);
  const c        = d.color;

  document.getElementById('node-detail').style.display = 'block';
  document.getElementById('node-detail').innerHTML = `
    <div class="node-detail" style="border-left-color:${c}">
      <div>
        <span class="detail-name">${esc(d.id)}</span>
        <span class="detail-meta"> · ${(asSource.length + asSub.length)} connections</span>
      </div>
      <div class="detail-impact">${asSource.length} outbound · ${asSub.length} inbound through Boomi</div>
      <button class="detail-clear">Clear</button>

      ${asSource.length ? `
        <div class="conn-group-title">Outbound (as Source Tower)</div>
        <div class="conn-items">
          ${asSource.map(r => `
            <div class="conn-item">
              <span class="conn-item-name">${esc(r.name)}</span>
              → ${esc(r.subscriber)} ${r.subscriberTower ? `<span style="font-size:10px;color:var(--muted)">(${esc(r.subscriberTower)})</span>` : ''}
            </div>`).join('')}
        </div>` : ''}

      ${asSub.length ? `
        <div class="conn-group-title">Inbound (as Subscriber Tower)</div>
        <div class="conn-items">
          ${asSub.map(r => `
            <div class="conn-item">
              <span class="conn-item-name">${esc(r.name)}</span>
              ← ${esc(r.subscriber)} ${r.sourceTower ? `<span style="font-size:10px;color:var(--muted)">(${esc(r.sourceTower)})</span>` : ''}
            </div>`).join('')}
        </div>` : ''}
    </div>`;

  document.querySelector('.detail-clear').addEventListener('click', (e) => { e.stopPropagation(); _clearDetail(); });
  _highlight(d.id, connections);
}

function _clearDetail() {
  _selectedTower = null;
  const panel = document.getElementById('node-detail');
  if (panel) panel.style.display = 'none';
  if (_state.nodeSel) {
    _state.nodeSel.classed('dimmed', false).classed('highlighted', false);
    _state.linkSel.classed('dimmed', false);
  }
}

function _highlight(towerId, connections) {
  const connected = new Set([towerId, HUB_ID]);
  connections.forEach(r => {
    if (r.sourceTower === towerId)    connected.add(r.subscriberTower);
    if (r.subscriberTower === towerId) connected.add(r.sourceTower);
  });
  _state.nodeSel.classed('dimmed',      d => !connected.has(d.id));
  _state.nodeSel.classed('highlighted', d => d.id === towerId);
  _state.linkSel.classed('dimmed',      d => {
    const s = typeof d.source === 'object' ? d.source.id : d.source;
    const t = typeof d.target === 'object' ? d.target.id : d.target;
    return s !== towerId && t !== towerId && s !== HUB_ID && t !== HUB_ID
      ? !(connected.has(s) && connected.has(t)) : false;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _abbrev(tower) {
  const m = tower.match(/\(([^)]+)\)$/);
  return m ? m[1] : tower.split(/\s+/).slice(0, 2).join(' ');
}

function _debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
