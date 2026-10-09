// Pure formatting for the shareable health summary — no device APIs, so it can be tested anywhere.
import { RECORD_TYPE_LABELS, DOCUMENT_TYPES, type HealthRecord } from '../types/healthRecords';
import { FOLLOW_UP_TYPE_LABELS, formatAbsolute, formatCalendarDate, type FollowUp } from '../types/followUps';
import { EXPENSE_CATEGORY_LABELS, formatAmount, parseLocalISODate, type Expense } from '../types/expenses';
import type { MedicalInfo } from '../types/emergency';

export type ReportData = {
  patientName: string;
  generatedAt: Date;
  medical?: MedicalInfo;
  records: HealthRecord[];
  followUps: FollowUp[];
  expenses?: { items: Expense[]; periodLabel: string; claimableOnly: boolean };
};

const DISCLAIMER = 'Patient-recorded data from the NexaCare app. Not clinically verified.';

// Records store dates as typed text; show "Mon, 5 Oct 2026" when it's a valid YYYY-MM-DD.
function displayDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatCalendarDate(parseLocalISODate(value)) : value;
}

// Everything user-typed goes through this before entering the HTML.
function esc(value: string | undefined | null): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitRecords(records: HealthRecord[]) {
  const documents = records.filter((r) => DOCUMENT_TYPES.includes(r.type));
  const vitals = records.filter((r) => !DOCUMENT_TYPES.includes(r.type));
  return { vitals, documents };
}

function expenseTotals(items: Expense[]) {
  const total = items.reduce((sum, e) => sum + e.amountPaise, 0);
  const claimable = items.filter((e) => e.claimable).reduce((sum, e) => sum + e.amountPaise, 0);
  return { total, claimable };
}

export function hasReportContent(data: ReportData): boolean {
  return !!data.medical || data.records.length > 0 || data.followUps.length > 0 || !!data.expenses?.items.length;
}

// ---------------- HTML (for the PDF) ----------------

export function buildReportHtml(data: ReportData): string {
  const { vitals, documents } = splitRecords(data.records);
  const sections: string[] = [];

  if (data.medical) {
    const m = data.medical;
    const rows = [
      ['Blood group', m.bloodGroup],
      ['Allergies', m.allergies],
      ['Conditions', m.conditions],
      ['Current medications', m.medications],
      ['Notes', m.notes],
    ].filter(([, v]) => v);
    sections.push(`
      <h2>Medical ID</h2>
      <table class="kv">${rows
        .map(([k, v]) => `<tr><th>${esc(k)}</th><td class="${k === 'Allergies' ? 'alert' : ''}">${esc(v)}</td></tr>`)
        .join('')}</table>`);
  }

  if (vitals.length) {
    sections.push(`
      <h2>Health readings <span class="count">${vitals.length}</span></h2>
      <table><thead><tr><th>Date</th><th>Type</th><th>Value</th><th>Notes</th></tr></thead><tbody>${vitals
        .map(
          (r) =>
            `<tr><td class="nowrap">${esc(displayDate(r.date))}</td><td>${esc(RECORD_TYPE_LABELS[r.type])}</td><td class="strong">${esc(r.value)}</td><td>${esc(r.notes)}</td></tr>`
        )
        .join('')}</tbody></table>`);
  }

  if (documents.length) {
    sections.push(`
      <h2>Reports &amp; prescriptions <span class="count">${documents.length}</span></h2>
      <table><thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Provider</th><th>Notes</th></tr></thead><tbody>${documents
        .map(
          (r) =>
            `<tr><td class="nowrap">${esc(displayDate(r.date))}</td><td>${esc(RECORD_TYPE_LABELS[r.type])}</td><td class="strong">${esc(r.value)}${
              r.attachmentName ? `<div class="muted">File: ${esc(r.attachmentName)} (not included)</div>` : ''
            }</td><td>${esc(r.providerName)}</td><td>${esc(r.notes)}</td></tr>`
        )
        .join('')}</tbody></table>`);
  }

  if (data.followUps.length) {
    sections.push(`
      <h2>Upcoming follow-ups <span class="count">${data.followUps.length}</span></h2>
      <table><thead><tr><th>When</th><th>Type</th><th>Title</th><th>Provider</th></tr></thead><tbody>${data.followUps
        .map(
          (f) =>
            `<tr><td class="nowrap">${esc(formatAbsolute(f.scheduledAt))}</td><td>${esc(FOLLOW_UP_TYPE_LABELS[f.type])}</td><td class="strong">${esc(f.title)}</td><td>${esc(f.providerName)}</td></tr>`
        )
        .join('')}</tbody></table>`);
  }

  if (data.expenses?.items.length) {
    const { items, periodLabel, claimableOnly } = data.expenses;
    const { total, claimable } = expenseTotals(items);
    sections.push(`
      <h2>Medical expenses <span class="count">${esc(periodLabel)}${claimableOnly ? ' · claimable only' : ''}</span></h2>
      <table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid to</th><th class="num">Amount</th></tr></thead><tbody>${items
        .map(
          (e) =>
            `<tr><td class="nowrap">${esc(displayDate(e.date))}</td><td>${esc(EXPENSE_CATEGORY_LABELS[e.category])}${
              e.claimable ? ' <span class="tag">Claimable</span>' : ''
            }</td><td>${esc(e.title)}</td><td>${esc(e.providerName)}</td><td class="num">${esc(formatAmount(e.amountPaise))}</td></tr>`
        )
        .join('')}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="num">${esc(formatAmount(total))}</td></tr>${
        !claimableOnly && claimable > 0
          ? `<tr class="sub"><td colspan="4">Claimable from insurance</td><td class="num">${esc(formatAmount(claimable))}</td></tr>`
          : ''
      }</tfoot></table>`);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: #12201D; font-size: 11pt; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #2E7D4F; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-size: 20pt; font-weight: 800; color: #123B72; }
  .brand span { color: #2E7D4F; }
  .tagline { font-size: 9pt; color: #6B7876; margin-top: 2px; }
  .meta { text-align: right; font-size: 9pt; color: #6B7876; }
  .patient { font-size: 14pt; font-weight: 700; color: #12201D; }
  .disclaimer { background: #F5F9F8; border-left: 3px solid #1E63B0; padding: 8px 10px; font-size: 9pt; color: #6B7876; margin-bottom: 8px; }
  h2 { font-size: 12.5pt; color: #123B72; margin: 18px 0 6px; page-break-after: avoid; }
  .count { font-size: 9pt; font-weight: 600; color: #6B7876; margin-left: 6px; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #DCE4E1; font-size: 10pt; }
  thead th { background: #F5F9F8; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.3px; color: #6B7876; }
  table.kv th { width: 32%; color: #6B7876; font-weight: 600; background: none; text-transform: none; letter-spacing: 0; font-size: 10pt; }
  .strong { font-weight: 600; }
  .muted { font-size: 8.5pt; color: #6B7876; font-weight: 400; margin-top: 2px; }
  .nowrap { white-space: nowrap; }
  .num { text-align: right; white-space: nowrap; }
  .alert { color: #C0392B; font-weight: 700; }
  .tag { font-size: 8pt; color: #2E7D4F; border: 1px solid #2E7D4F; border-radius: 8px; padding: 0 5px; margin-left: 4px; }
  tfoot td { font-weight: 700; border-bottom: none; border-top: 2px solid #12201D; }
  tfoot tr.sub td { font-weight: 600; color: #2E7D4F; border-top: none; }
  footer { margin-top: 24px; font-size: 8.5pt; color: #6B7876; text-align: center; }
</style></head>
<body>
  <header>
    <div>
      <div class="brand">Nexa<span>Care</span></div>
      <div class="tagline">People · Health · Together</div>
    </div>
    <div class="meta">
      <div class="patient">${esc(data.patientName)}</div>
      <div>Health summary · generated ${esc(formatAbsolute(data.generatedAt))}</div>
    </div>
  </header>
  <div class="disclaimer">${esc(DISCLAIMER)} Please confirm important details with the patient.</div>
  ${sections.join('\n')}
  <footer>${esc(DISCLAIMER)}</footer>
</body></html>`;
}

// ---------------- Plain text (for chat apps) ----------------

export function buildReportText(data: ReportData): string {
  const { vitals, documents } = splitRecords(data.records);
  const lines: string[] = [
    `NexaCare health summary — ${data.patientName}`,
    `Generated ${formatAbsolute(data.generatedAt)}`,
  ];

  if (data.medical) {
    const m = data.medical;
    lines.push('', 'MEDICAL ID');
    if (m.bloodGroup) lines.push(`Blood group: ${m.bloodGroup}`);
    if (m.allergies) lines.push(`Allergies: ${m.allergies}`);
    if (m.conditions) lines.push(`Conditions: ${m.conditions}`);
    if (m.medications) lines.push(`Medications: ${m.medications}`);
    if (m.notes) lines.push(`Notes: ${m.notes}`);
  }

  if (vitals.length) {
    lines.push('', 'HEALTH READINGS');
    for (const r of vitals) lines.push(`• ${displayDate(r.date)} — ${RECORD_TYPE_LABELS[r.type]}: ${r.value}${r.notes ? ` (${r.notes})` : ''}`);
  }

  if (documents.length) {
    lines.push('', 'REPORTS & PRESCRIPTIONS');
    for (const r of documents) {
      lines.push(`• ${displayDate(r.date)} — ${RECORD_TYPE_LABELS[r.type]}: ${r.value}${r.providerName ? `, ${r.providerName}` : ''}`);
    }
  }

  if (data.followUps.length) {
    lines.push('', 'UPCOMING FOLLOW-UPS');
    for (const f of data.followUps) {
      lines.push(`• ${formatAbsolute(f.scheduledAt)} — ${f.title}${f.providerName ? `, ${f.providerName}` : ''}`);
    }
  }

  if (data.expenses?.items.length) {
    const { items, periodLabel, claimableOnly } = data.expenses;
    const { total } = expenseTotals(items);
    lines.push('', `MEDICAL EXPENSES (${periodLabel}${claimableOnly ? ', claimable only' : ''})`);
    for (const e of items) lines.push(`• ${displayDate(e.date)} — ${e.title}: ${formatAmount(e.amountPaise)}`);
    lines.push(`Total: ${formatAmount(total)}`);
  }

  lines.push('', DISCLAIMER);
  return lines.join('\n');
}
