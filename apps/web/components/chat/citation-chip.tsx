'use client';

import React from 'react';
import { FileCode, Globe, Box, FunctionSquare, Compass } from 'lucide-react';
import { Citation } from '@/hooks/use-chat';

interface CitationChipProps {
  citation: Citation;
}

export function CitationChip({ citation }: CitationChipProps) {
  const getIcon = (label?: string) => {
    switch (label?.toLowerCase()) {
      case 'apiendpoint':
        return <Globe className="h-3 w-3 text-sky-400" />;
      case 'class':
        return <Box className="h-3 w-3 text-amber-400" />;
      case 'function':
        return <FunctionSquare className="h-3 w-3 text-emerald-400" />;
      default:
        return <FileCode className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const displayName = citation.symbolFqn || citation.filePath || 'Reference';
  const lineSuffix = citation.startLine ? `:${citation.startLine}` : '';

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/60 hover:bg-secondary border border-border/40 text-xs font-mono transition-colors"
      title={`${citation.label || 'Symbol'}: ${displayName}${lineSuffix}`}
    >
      {getIcon(citation.label)}
      <span className="max-w-[240px] truncate text-foreground/90">
        {citation.filePath ? `${citation.filePath}${lineSuffix}` : displayName}
      </span>
      {citation.label && (
        <span className="text-[10px] px-1 py-0.2 rounded bg-muted text-muted-foreground uppercase font-sans">
          {citation.label}
        </span>
      )}
    </div>
  );
}
