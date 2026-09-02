'use client';

import React from 'react';
import { Bot, User, Clock, Cpu, Compass } from 'lucide-react';
import { ChatMessageItem } from '@/hooks/use-chat';
import { CitationChip } from './citation-chip';

interface ChatMessageProps {
  message: ChatMessageItem;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3.5 py-4 px-4 rounded-xl transition-colors ${
        isUser
          ? 'bg-muted/40 ml-12 border border-border/30'
          : 'bg-card mr-6 border border-border/50 shadow-sm'
      }`}
    >
      {/* Avatar */}
      <div
        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
          isUser
            ? 'bg-primary/20 text-primary border border-primary/30'
            : 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2.5 overflow-hidden">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {isUser ? 'You' : 'Repository AI'}
          </span>
          <div className="flex items-center gap-2">
            {message.intent && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary font-mono">
                <Compass className="h-2.5 w-2.5 text-sky-400" />
                {message.intent}
              </span>
            )}
            {message.latencyMs && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {(message.latencyMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>

        {/* Message Body */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground/95 break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-violet-400 animate-pulse align-middle" />
          )}
        </div>

        {/* Citations Grounded in Neo4j Graph */}
        {message.citations && message.citations.length > 0 && (
          <div className="pt-2 border-t border-border/40 mt-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Grounded Graph Citations ({message.citations.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((citation, idx) => (
                <CitationChip key={idx} citation={citation} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
