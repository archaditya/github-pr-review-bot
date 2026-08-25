import { Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          archadi-pr-review
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign in to review your pull requests
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Connect your GitHub account to see review activity across the repositories you&apos;ve
          installed the bot on.
        </p>
      </div>
      <Button size="lg" asChild>
        <a href={`${API_URL}/auth/github/login`}>
          <Github className="h-4 w-4" />
          Continue with GitHub
        </a>
      </Button>
    </main>
  );
}
