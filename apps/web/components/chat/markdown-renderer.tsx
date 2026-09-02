'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

function renderInline(text: string): React.ReactNode[] {
  // Regex to match code `code`, bold **bold**, italic *italic*
  const tokens: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }
    const chunk = match[0];
    if (chunk.startsWith('`') && chunk.endsWith('`')) {
      const code = chunk.slice(1, -1);
      tokens.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-secondary/80 font-mono text-[12px] text-violet-300 border border-border/50"
        >
          {code}
        </code>,
      );
    } else if (chunk.startsWith('**') && chunk.endsWith('**')) {
      const bold = chunk.slice(2, -2);
      tokens.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {bold}
        </strong>,
      );
    } else if (chunk.startsWith('*') && chunk.endsWith('*')) {
      const italic = chunk.slice(1, -1);
      tokens.push(
        <em key={match.index} className="italic text-foreground/90">
          {italic}
        </em>,
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens;
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-lg border border-border/60 bg-black/40 overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/30 border-b border-border/40 text-[11px] text-muted-foreground">
        <span>{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded"
          title="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-muted-foreground text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <CodeBlock
            key={`code-${i}`}
            code={codeBuffer.join('\n')}
            lang={codeLang}
          />,
        );
        codeBuffer = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        // Start of code block
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-foreground mt-3 mb-1.5 tracking-tight">
          {renderInline(trimmed.slice(4))}
        </h3>,
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-base font-semibold text-foreground mt-4 mb-2 tracking-tight">
          {renderInline(trimmed.slice(3))}
        </h2>,
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-lg font-bold text-foreground mt-4 mb-2 tracking-tight">
          {renderInline(trimmed.slice(2))}
        </h1>,
      );
      continue;
    }

    // Bullet lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const indent = line.search(/\S/);
      const isNested = indent >= 2;
      const bulletText = trimmed.slice(2);

      elements.push(
        <div
          key={i}
          className={`flex items-start gap-2 text-sm text-foreground/90 my-1 ${
            isNested ? 'ml-5' : 'ml-1'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 mt-2 shrink-0 opacity-80" />
          <div className="leading-relaxed flex-1">{renderInline(bulletText)}</div>
        </div>,
      );
      continue;
    }

    // Empty lines
    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular paragraphs
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-foreground/95 my-1">
        {renderInline(line)}
      </p>,
    );
  }

  // Flush open code block if stream cut off
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <CodeBlock
        key="code-unclosed"
        code={codeBuffer.join('\n')}
        lang={codeLang}
      />,
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}
