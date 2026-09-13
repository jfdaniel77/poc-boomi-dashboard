#!/usr/bin/env node
/**
 * Converts raw Markdown data files into clean JSON for the dashboard.
 * Strips source URLs — only names and tower classifications are output.
 * Run: node scripts/parse-data.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_DIR = path.join(ROOT, 'docs', 'data');

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Parse the first markdown table found after `sectionHeader`.
function parseTableAfter(content, sectionHeader) {
  const idx = content.indexOf(sectionHeader);
  if (idx === -1) return [];

  const lines = content.slice(idx).split('\n');
  const rows = [];
  let separatorFound = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      if (separatorFound) break;
      continue;
    }
    // Separator row: |---|---|---| or |:---|:---|
    if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
      separatorFound = true;
      continue;
    }
    if (separatorFound) {
      const cells = trimmed.split('|').slice(1, -1).map(c => decodeHtml(c.trim()));
      rows.push(cells);
    }
  }

  return rows;
}

// Extract tower names from the "Proposed Application Tower" cell.
// Formats: "[System/ID/Tower]" or "[ConnectorName - Tower]", separated by "; "
function extractProposedTowers(raw) {
  if (!raw) return [];
  const towers = new Set();
  for (const seg of raw.split(';')) {
    const m = seg.match(/\[([^\]]+)\]/);
    if (!m) continue;
    const inner = m[1];
    const slashParts = inner.split('/');
    if (slashParts.length >= 3) {
      towers.add(slashParts[slashParts.length - 1].trim());
    } else {
      const dashIdx = inner.lastIndexOf(' - ');
      if (dashIdx !== -1) towers.add(inner.slice(dashIdx + 3).trim());
    }
  }
  return [...towers];
}

// --- API connections (api_proxy + api_service) ---
// Columns: Group | Name | Source URL (stripped) | Source Tower | Subscriber | Subscriber Tower | Notes
function parseApiConnections() {
  const filePath = path.join(DATA_DIR, 'confluence-api-conn-mapping.md');
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠  Not found: ${filePath}`);
    return [];
  }

  const rows = parseTableAfter(fs.readFileSync(filePath, 'utf-8'), '## Mapping Table');
  const connections = [];
  let currentGroup = '';
  let currentName = '';
  let currentSourceTower = '';

  for (const row of rows) {
    if (row.length < 6) continue;
    // index 2 is source URL — intentionally skipped (not output)
    const [group, name, , sourceTower, subscriber, subscriberTower] = row;

    if (group)       currentGroup       = group;
    if (name)        currentName        = name;
    if (sourceTower) currentSourceTower = sourceTower;

    if (!subscriber) continue;

    connections.push({
      group:          currentGroup,
      name:           currentName,
      sourceTower:    currentSourceTower,
      subscriber,
      subscriberTower: subscriberTower || '',
    });
  }

  return connections;
}

// --- Scheduled jobs ---
// Columns: Process Name | Environments | Connectors | Source | Target | Proposed Tower | Notes
function parseScheduledJobs() {
  const filePath = path.join(DATA_DIR, 'confluence-scheduled-conn-mapping.md');
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠  Not found: ${filePath}`);
    return [];
  }

  const rows = parseTableAfter(fs.readFileSync(filePath, 'utf-8'), '## Mapping Table');
  const jobs = [];

  for (const row of rows) {
    if (row.length < 6) continue;
    const [processName, environments, connectors, source, target, proposedTower] = row;
    if (!processName) continue;

    jobs.push({
      processName,
      environments:   environments ? environments.split(',').map(e => e.trim()).filter(Boolean) : [],
      connectors:     connectors   ? connectors.split(',').map(c => c.trim()).filter(Boolean)   : [],
      source:         source  || '',
      target:         target  || '',
      proposedTowers: extractProposedTowers(proposedTower),
    });
  }

  return jobs;
}

// --- Main ---
function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Parsing API connections...');
  const apiConnections = parseApiConnections();
  fs.writeFileSync(
    path.join(OUT_DIR, 'api-connections.json'),
    JSON.stringify(apiConnections, null, 2)
  );
  console.log(`  → ${apiConnections.length} rows`);

  console.log('Parsing scheduled jobs...');
  const scheduledJobs = parseScheduledJobs();
  fs.writeFileSync(
    path.join(OUT_DIR, 'scheduled-jobs.json'),
    JSON.stringify(scheduledJobs, null, 2)
  );
  console.log(`  → ${scheduledJobs.length} rows`);

  console.log('Done ✓');
}

main();
