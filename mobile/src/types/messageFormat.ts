// Turns the assistant's light Markdown (bold, bullets, numbered lists, headings, simple tables)
// into blocks the chat can render — so replies never show raw "**" or "|" characters.

export type InlinePart = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

export type MessageBlock =
  | { kind: 'heading'; parts: InlinePart[] }
  | { kind: 'paragraph'; parts: InlinePart[] }
  | { kind: 'bullet'; parts: InlinePart[]; level: number }
  | { kind: 'number'; parts: InlinePart[]; n: string; level: number }
  | { kind: 'gap' };

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\s][^*\n]*\*)/g;

export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  for (const piece of text.split(INLINE)) {
    if (!piece) continue;
    if ((piece.startsWith('**') && piece.endsWith('**')) || (piece.startsWith('__') && piece.endsWith('__'))) {
      parts.push({ text: piece.slice(2, -2), bold: true });
    } else if (piece.startsWith('`') && piece.endsWith('`') && piece.length > 2) {
      parts.push({ text: piece.slice(1, -1), code: true });
    } else if (piece.startsWith('*') && piece.endsWith('*') && piece.length > 2) {
      parts.push({ text: piece.slice(1, -1), italic: true });
    } else {
      parts.push({ text: piece });
    }
  }
  return parts;
}

const isTableDivider = (line: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line);

export function parseMessage(text: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  let tableHeader: string[] | null = null;

  const pushGap = () => {
    if (blocks.length && blocks[blocks.length - 1].kind !== 'gap') blocks.push({ kind: 'gap' });
  };

  // The AI sometimes uses no-break spaces/hyphens that some Android fonts draw as boxes.
  const clean = text
    .replace(/\r\n/g, '\n')
    .replace(/[   ]/g, ' ')
    .replace(/[‐‑]/g, '-');

  for (const raw of clean.split('\n')) {
    const indent = raw.match(/^\s*/)![0].replace(/\t/g, '  ').length;
    const level = indent >= 2 ? 1 : 0;
    const line = raw.trim();

    if (!line.startsWith('|')) tableHeader = null;

    if (!line) {
      pushGap();
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      pushGap();
      continue;
    }

    // Tables: first row is the header; each later row becomes "Header: value · Header: value".
    if (line.startsWith('|')) {
      if (isTableDivider(line)) continue;
      const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (!tableHeader) {
        tableHeader = cells;
        continue;
      }
      const header = tableHeader;
      const [first, ...rest] = cells;
      const detail = rest
        .map((c, i) => (header[i + 1] ? `${header[i + 1]}: ${c}` : c))
        .filter((c) => c.replace(/^[^:]*:\s*/, ''))
        .join(' · ');
      blocks.push({ kind: 'bullet', level: 0, parts: [{ text: first, bold: true }, ...(detail ? parseInline(` — ${detail}`) : [])] });
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', parts: parseInline(heading[1].replace(/\*\*/g, '')) });
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      blocks.push({ kind: 'bullet', level, parts: parseInline(bullet[1]) });
      continue;
    }
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      blocks.push({ kind: 'number', level, n: numbered[1], parts: parseInline(numbered[2]) });
      continue;
    }
    blocks.push({ kind: 'paragraph', parts: parseInline(line) });
  }

  while (blocks.length && blocks[blocks.length - 1].kind === 'gap') blocks.pop();
  return blocks;
}
