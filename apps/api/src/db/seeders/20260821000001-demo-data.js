'use strict';

const { randomUUID } = require('crypto');

const userId = randomUUID();
const installationId = randomUUID();
const repositoryId = randomUUID();
const pullRequestId = randomUUID();
const completedJobId = randomUUID();
const pendingJobId = randomUUID();

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        id: userId,
        github_user_id: 1000001,
        email: 'demo@example.com',
        name: 'Demo User',
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('installations', [
      {
        id: installationId,
        github_installation_id: 2000001,
        account_login: 'demo-org',
        installed_by_user_id: userId,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('repositories', [
      {
        id: repositoryId,
        installation_id: installationId,
        github_repo_id: 3000001,
        full_name: 'demo-org/demo-repo',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('pull_requests', [
      {
        id: pullRequestId,
        repository_id: repositoryId,
        github_pr_number: 42,
        title: 'Change sum() signature to accept a third argument',
        head_sha: 'abc1234',
        base_sha: 'def5678',
        author_login: 'demo-contributor',
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('review_jobs', [
      {
        id: completedJobId,
        pull_request_id: pullRequestId,
        status: 'COMPLETED',
        attempt_count: 1,
        error: null,
        started_at: now,
        completed_at: now,
        created_at: now,
        updated_at: now,
      },
      {
        id: pendingJobId,
        pull_request_id: pullRequestId,
        status: 'PENDING',
        attempt_count: 0,
        error: null,
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('review_comments', [
      {
        id: randomUUID(),
        review_job_id: completedJobId,
        body:
          '### AI Review Summary\n\n- `sum(a, b)` signature changed to `sum(a, b, c)` — ' +
          '2 call sites in `src/billing/invoice.js` were not updated and will now pass ' +
          '`undefined` as `c`.\n- No other breaking changes detected.',
        github_comment_id: 4000001,
        findings: JSON.stringify([
          {
            file: 'src/billing/invoice.js',
            line: 42,
            severity: 'high',
            rationale: 'Call site not updated for the new sum(a, b, c) signature.',
          },
        ]),
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('job_events', [
      {
        id: randomUUID(),
        review_job_id: completedJobId,
        step: 'fetch_diff',
        status: 'succeeded',
        detail: JSON.stringify({ changed_files: 2 }),
        created_at: now,
      },
      {
        id: randomUUID(),
        review_job_id: completedJobId,
        step: 'generate_review',
        status: 'succeeded',
        detail: JSON.stringify({ findings_count: 1 }),
        created_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('job_events', null, {});
    await queryInterface.bulkDelete('review_comments', null, {});
    await queryInterface.bulkDelete('review_jobs', null, {});
    await queryInterface.bulkDelete('pull_requests', null, {});
    await queryInterface.bulkDelete('repositories', null, {});
    await queryInterface.bulkDelete('installations', null, {});
    await queryInterface.bulkDelete('users', null, {});
  },
};
