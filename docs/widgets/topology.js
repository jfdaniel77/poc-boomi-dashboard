import { towerColor, esc, helpToggle } from './utils.js';

const HUB_ID    = '__boomi__';
const HUB_COLOR = '#5E7A89';

let _state = { nodeSel: null, linkSel: null };
let _allConnections  = [];
let _selectedTower   = null;

export function render({ apiConnections }) {
  const el = document.getElementById('tab-topology');
  _allConnections = apiConnections;

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header-row">
        <div class="section-label" style="flex:1">Integration Source Topology</div>
        <button class="help-btn" aria-expanded="false" aria-controls="help-topo">?</button>
      </div>
      <div id="help-topo" class="help-panel" hidden>
        <p>Source towers (right) feed data through the Boomi platform (centre) to subscriber towers (left). Line thickness represents the number of integrations between two towers.</p>
        <ul>
          <li>Click a <strong>source tower</strong> to highlight its subscriber connections and see the list of processes.</li>
          <li>Click the background or <em>Clear</em> to reset.</li>
        </ul>
      </div>
      <svg id="topo-svg" class="topo-svg" aria-label="Integration topology bipartite graph"></svg>
      <div id="node-detail" style="display:none"></div>
    </div>`;

  helpToggle(el);
  _buildBipartite();
}

function _buildBipartite() {
  const connections = _allConnections;
  if (!connections.length) return;

  // Build edge map: sourceTower → subscriberTower → count
  const edgeMap = {};
  const srcTowerSet = new Set();
  const subTowerSet = new Set();

  connections.forEach(({ sourceTower: s, subscriberTower: t }) => {
    if (!s || !t) return;
    srcTowerSet.add(s);
    subTowerSet.add(t);
    if (!edgeMap[s]) edgeMap[s] = {};
    edgeMap[s][t] = (edgeMap[s][t] || 0) + 1;
  });

  const srcArr = [...srcTowerSet].sort();
  const subArr = [...subTowerSet].sort();

  const svgEl = document.getElementById('topo-svg');
  const W = svgEl.clientWidth || 820;
  const H = Math.max(480, Math.max(srcArr.length, subArr.length) * 52 + 80);
  const PAD = 50;
  const NODE_R = 11;

  const srcNodes = srcArr.map((id, i) => ({
    id, side: 'source',
    x: W * 0.78,
    y: srcArr.length === 1 ? H / 2 : PAD + i * (H - 2 * PAD) / (srcArr.length - 1),
    color: towerColor(id),
    r: NODE_R,
  }));

  const subNodes = subArr.map((id, i) => ({
    id, side: 'subscriber',
    x: W * 0.22,
    y: subArr.length === 1 ? H / 2 : PAD + i * (H - 2 * PAD) / (subArr.length - 1),
    color: towerColor(id),
    r: NODE_R,
  }));

  const allNodes = [...subNodes, ...srcNodes];
  const hub = { x: W * 0.50, y: H * 0.50 };

  // Build links
  const links = [];
  Object.entries(edgeMap).forEach(([src, targets]) => {
    Object.entries(targets).forEach(([tgt, count]) => {
      const srcNode = srcNodes.find(n => n.id === src);
      const subNode = subNodes.find(n => n.id === tgt);
      if (srcNode && subNode) links.push({ src, tgt, count, srcNode, subNode });
    });
  });

  const maxCount = Math.max(...links.map(l => l.count), 1);

  // SVG
  const svg = d3.select(svgEl)
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('height', H)
    .attr('style', 'height:' + H + 'px');
  svg.selectAll('*').remove();

  const g = svg.append('g');

  // Side labels
  g.append('text')
    .attr('x', W * 0.78).attr('y', 22)
    .attr('text-anchor', 'middle')
    .attr('font-size', 11).attr('font-weight', 700).attr('letter-spacing', '0.08em')
    .attr('fill', '#6b6760').text('SOURCE');

  g.append('text')
    .attr('x', W * 0.22).attr('y', 22)
    .attr('text-anchor', 'middle')
    .attr('font-size', 11).attr('font-weight', 700).attr('letter-spacing', '0.08em')
    .attr('fill', '#6b6760').text('SUBSCRIBER');

  // Links (quadratic bezier through hub midpoint)
  _state.linkSel = g.append('g')
    .selectAll('path')
    .data(links)
    .join('path')
    .attr('class', 'topo-link')
    .attr('fill', 'none')
    .attr('stroke-width', d => 0.8 + (d.count / maxCount) * 4.5)
    .attr('d', d => {
      const x1 = d.srcNode.x, y1 = d.srcNode.y;
      const x2 = d.subNode.x, y2 = d.subNode.y;
      const cy = (y1 + y2) / 2;
      return `M${x1},${y1} Q${hub.x},${cy} ${x2},${y2}`;
    });

  // Hub
  g.append('circle')
    .attr('cx', hub.x).attr('cy', hub.y)
    .attr('r', 24).attr('fill', HUB_COLOR);
  ['Boomi', 'Platform'].forEach((line, i) =>
    g.append('text')
      .attr('x', hub.x).attr('y', hub.y + (i === 0 ? -4 : 10))
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', 700)
      .attr('fill', '#fff').attr('pointer-events', 'none').text(line)
  );

  // Nodes
  _state.nodeSel = g.append('g')
    .selectAll('g')
    .data(allNodes)
    .join('g')
    .attr('class', 'topo-node')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .style('cursor', d => d.side === 'source' ? 'pointer' : 'default');

  _state.nodeSel.append('circle')
    .attr('r', d => d.r)
    .attr('fill', d => d.color);

  _state.nodeSel.append('text')
    .attr('x', d => d.side === 'source' ? d.r + 7 : -(d.r + 7))
    .attr('y', 4)
    .attr('text-anchor', d => d.side === 'source' ? 'start' : 'end')
    .attr('font-size', 10).attr('pointer-events', 'none')
    .attr('fill', 'var(--text)')
    .text(d => _abbrev(d.id));

  _state.nodeSel.append('title').text(d => d.id);

  // Click source nodes
  _state.nodeSel.filter(d => d.side === 'source')
    .on('click', (event, d) => {
      event.stopPropagation();
      _selectedTower === d.id ? _clearDetail() : _showDetail(d, connections);
    });

  svg.on('click', () => _clearDetail());

  window.addEventListener('resize', _debounce(() => render({ apiConnections: _allConnections }), 300), { once: true });
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function _showDetail(d, connections) {
  _selectedTower = d.id;

  const outbound       = connections.filter(r => r.sourceTower === d.id);
  const connectedSubs  = new Set(outbound.map(r => r.subscriberTower).filter(Boolean));

  // Dim/highlight
  _state.nodeSel
    .classed('dimmed',      n => n.side === 'source' ? n.id !== d.id : !connectedSubs.has(n.id))
    .classed('highlighted', n => n.id === d.id);
  _state.linkSel.classed('dimmed', l => l.src !== d.id);

  document.getElementById('node-detail').style.display = 'block';
  document.getElementById('node-detail').innerHTML = `
    <div class="node-detail" style="border-left-color:${d.color}">
      <div>
        <span class="detail-name">${esc(d.id)}</span>
        <span class="detail-meta"> · ${outbound.length} processes · ${connectedSubs.size} subscriber tower${connectedSubs.size !== 1 ? 's' : ''}</span>
      </div>
      <button class="detail-clear">Clear</button>

      <div class="conn-group-title">Processes originating from this tower</div>
      <div class="conn-items">
        ${outbound.map(r => `
          <div class="conn-item">
            <span class="conn-item-name">${esc(r.name)}</span>
            <span style="color:var(--muted)"> → </span>${esc(r.subscriber || '—')}
            ${r.subscriberTower ? `<span style="font-size:10px;color:var(--muted)"> (${esc(r.subscriberTower)})</span>` : ''}
          </div>`).join('')}
      </div>
    </div>`;

  document.querySelector('.detail-clear')
    .addEventListener('click', e => { e.stopPropagation(); _clearDetail(); });
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function _abbrev(tower) {
  const m = tower.match(/\(([^)]+)\)$/);
  return m ? m[1] : tower.split(/\s+/).slice(0, 2).join(' ');
}

function _debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
