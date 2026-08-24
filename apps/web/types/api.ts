/**
 * Mirrors apps/api/src/models/ and the JSON shapes its controllers return. Keep this in
 * sync with apps/api whenever a response shape changes (there's no shared codegen between
 * the two yet — see PROGRESS.md).
 */

export type ReviewJobStatus =
  | 'PENDING'
  | 'FETCHING_DIFF'
  | 'RESOLVING_USAGES'
  | 'GENERATING_REVIEW'
  | 'POSTING_COMMENTS'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface User {
  id: string;
  githubUserId: number;
  email: string | null;
  name: string | null;
}

export interface Repository {
  id: string;
  installationId: string;
  githubRepoId: number;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestSummary {
  id: string;
  githubPrNumber: number;
  title: string;
  authorLogin: string;
}

export interface ReviewJob {
  id: string;
  pullRequestId: string;
  status: ReviewJobStatus;
  attemptCount: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  pullRequest?: PullRequestSummary;
}

export interface Finding {
  file: string;
  line: number | null;
  severity: Severity;
  rationale: string;
}

export interface ReviewComment {
  id: string;
  body: string;
  githubCommentId: number;
  findings: Finding[];
}

export interface ConversationMessage {
  id: string;
  authorType: 'bot' | 'user';
  authorLogin: string;
  body: string;
  createdAt: string;
}

export interface JobEvent {
  id: string;
  step: string;
  status: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface ReviewJobDetail extends ReviewJob {
  summaryComment?: ReviewComment | null;
  conversationMessages: ConversationMessage[];
  events: JobEvent[];
}
