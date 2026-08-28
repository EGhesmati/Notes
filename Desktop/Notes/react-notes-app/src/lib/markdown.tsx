// Lightweight, dependency-free markdown renderer for note text.
// Supports: headings (##, ###), bold, italics, inline code, code blocks,
// unordered/ordered lists, blockquotes, horizontal rules, and links.
// Deliberately minimal + safe: renders into simple React nodes (no innerHTML).

import type { ReactNode } from "react";

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // tokenise inline code first so other markdown inside isn't processed
  const parts = text.split(/(`[^`]+`)/g);
  let fallback = 0;

  parts.forEach((part, i) => {
    if (/^`.+`$/.test(part)) {
      nodes.push(
        <code key={`${keyPrefix}-code-${i}`} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-primary">
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }
    // bold **text**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    boldParts.forEach((bp, j) => {
      if (/^\*\*[^*]+\*\*$/.test(bp)) {
        nodes.push(<strong key={`${keyPrefix}-b-${i}-${j}`}>{bp.slice(2, -2)}</strong>);
        return;
      }
      // italic *text*
      const italicParts = bp.split(/(\*[^*]+\*)/g);
      italicParts.forEach((ip, k) => {
        if (/^\*[^*]+\*$/.test(ip)) {
          nodes.push(<em key={`${keyPrefix}-i-${i}-${j}-${k}`}>{ip.slice(1, -1)}</em>);
          return;
        }
        // links [text](url)
        const linkParts = ip.split(/(\[[^\]]+\]\([^)]+\))/g);
        linkParts.forEach((lp, m) => {
          const linkMatch = lp.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
          if (linkMatch) {
            nodes.push(
              <a key={`${keyPrefix}-l-${i}-${j}-${k}-${m}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline decoration-sky-300 underline-offset-2 dark:text-sky-400">
                {linkMatch[1]}
              </a>,
            );
            return;
          }
          nodes.push(<span key={`${keyPrefix}-t-${i}-${j}-${k}-${m}-${fallback++}`}>{lp}</span>);
        });
      });
    });
  });

  return nodes;
}

export function renderMarkdown(md: string): ReactNode {
  if (!md) return null;

  const lines = md.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let inCode = false;
  let codeLines: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // code block fences (``` or ~~~)
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      if (!inCode) {
        inCode = true;
        codeLines = [];
      } else {
        inCode = false;
        blocks.push(
          <pre key={`block-${i}`} className="my-1.5 overflow-x-auto rounded-md bg-muted p-2 text-[0.82em] leading-relaxed">
            <code className="font-mono">{codeLines.join("\n")}</code>
          </pre>,
        );
      }
      i++;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      i++;
      continue;
    }

    const trimmed = line.trim();

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`block-${i}`} className="my-2 border-border/50" />);
      i++;
      continue;
    }

    // headings
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const H = (`h${level}`) as "h1" | "h2" | "h3" | "h4";
      blocks.push(
        <H key={`block-${i}`} className="my-1.5 font-semibold text-foreground first:mt-0" style={{ fontSize: `${1.3 - level * 0.12}rem` }}>
          {inline(heading[2], `h${i}`)}
        </H>,
      );
      i++;
      continue;
    }

    // blockquote
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      blocks.push(
        <blockquote key={`block-${i}`} className="my-1.5 border-l-2 border-muted-foreground/30 pl-2 text-muted-foreground">
          {inline(quote[1], `q${i}`)}
        </blockquote>,
      );
      i++;
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(
          <li key={`li-${i}`}>{inline(lines[i].replace(/^\s*[-*+]\s+/, ""), `li-${i}`)}</li>,
        );
        i++;
      }
      blocks.push(<ul key={`ul-${i}`} className="my-1.5 list-disc pl-5">{items}</ul>);
      continue;
    }

    // ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(
          <li key={`oli-${i}`}>{inline(lines[i].replace(/^\s*\d+[.)]\s+/, ""), `oli-${i}`)}</li>,
        );
        i++;
      }
      blocks.push(<ol key={`ol-${i}`} className="my-1.5 list-decimal pl-5">{items}</ol>);
      continue;
    }

    // blank line -> keep spacing, render nothing special
    if (trimmed === "") {
      i++;
      continue;
    }

    // paragraph (single line or consecutive non-blank lines)
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^\s*(#{1,4}|```|~~~|>|[-*+]\s|\d+[.)]\s)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p-${i}`} className="my-1.5 first:mt-0 last:mb-0">
        {para.map((pl, idx) => (
          <span key={`${i}-${idx}`}>{idx > 0 ? <br /> : null}{inline(pl, `p-${i}-${idx}`)}</span>
        ))}
      </p>,
    );
  }

  return (
    <div className="break-words">
      {blocks}
    </div>
  );
}
