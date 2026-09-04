/**
 * Mirrors apps/api/src/models/ and the JSON shapes its controllers return.
 */

export type ReviewJobStatus =
  | 'PENDING'
  | 'FETCHING_DIFF'
  | 'ANALYZING_IMPACT'
  | 'BUILDING_CONTEXT'
  | 'GENERATING_REVIEW'
  | 'POSTING_COMMENTS'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'RESOLVING_USAGES'; // legacy fallback

export type RepoIndexStatus =
  | 'NOT_INDEXED'
  | 'INDEXING'
  | 'INDEXED'
  | 'REINDEXING'
  | 'FAILED';

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
  indexStatus: RepoIndexStatus;
  indexedCommitSha: string | null;
  indexedAt: string | null;
  defaultBranch: string;
  indexError: string | null;
  fileCount: number;
  symbolCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestSummary {
  id: string;
  githubPrNumber: number;
  title: string;
  authorLogin: string;
  headSha?: string;
  baseSha?: string;
  reviewJobs?: ReviewJobDetail[];
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
  evidence?: string | null;
  confidence?: 'high' | 'medium' | 'low' | null;
  affected_symbols?: string[];
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

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  rawKey?: string;
}
