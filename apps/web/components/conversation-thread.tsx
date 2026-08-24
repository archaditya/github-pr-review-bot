import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationMessage } from '@/types/api';

export function ConversationThread({ messages }: { messages: ConversationMessage[] }) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'flex gap-3 rounded-lg border px-4 py-3',
            message.authorType === 'bot' ? 'border-primary/20 bg-primary/5' : 'border-border bg-card',
          )}
        >
          <div
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
              message.authorType === 'bot' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            {message.authorType === 'bot' ? (
              <Bot className="h-3.5 w-3.5" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">@{message.authorLogin}</span>
            <p className="whitespace-pre-wrap text-sm text-foreground">{message.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
