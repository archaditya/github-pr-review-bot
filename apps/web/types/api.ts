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

export interface UserFeatures {
  can_review_prs?: boolean;
  can_repo_chat?: boolean;
  can_social_studio?: boolean;
  allowed_social_platforms?: ('x' | 'linkedin' | 'instagram' | 'facebook')[];
  social_monthly_quota?: number;
  ai_provider_mode?: 'byok_only' | 'managed';
  max_indexed_repos?: number;
}

export interface UserUsage {
  review_count: number;
  post_count: number;
  chat_count: number;
  reset_at: string | null;
}

export interface User {
  id: string;
  githubUserId: number;
  email: string | null;
  name: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'suspended';
  features: UserFeatures;
  preferences?: Record<string, any>;
  usage?: UserUsage;
  hasOpenaiKey?: boolean;
  maskedOpenaiKey?: string | null;
  lastActiveAt?: string | null;
  createdAt?: string;
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
  aiReviewEnabled?: boolean;
  reviewLevel?: 'balanced' | 'strict' | 'permissive';
  customVoice?: string | null;
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
  createdAt?: string;
  updatedAt?: string;
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
  isRevoked?: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  rawKey?: string;
}

export type SocialPlatform = 'x' | 'linkedin' | 'instagram' | 'facebook';
export type SocialPostStatus = 'draft' | 'approved' | 'published' | 'failed';

export interface SocialPost {
  id: string;
  pullRequestId: string | null;
  platform: SocialPlatform;
  draftText: string;
  editedText: string | null;
  imageUrl: string | null;
  status: SocialPostStatus;
  publishedAt: string | null;
  externalPostId: string | null;
  postUrl?: string | null;
  error: string | null;
  standaloneInput: string | null;
  repoContext: string | null;
  createdAt: string;
  updatedAt: string;
  pullRequest?: PullRequestSummary | null;
}

export interface PublishResult {
  id: string;
  platform: SocialPlatform;
  status: 'published' | 'failed';
  error?: string;
}

