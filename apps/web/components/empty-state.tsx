export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
