const config = require('../../config');

let appInstance;

/**
 * Lazily constructs the App singleton — not built at require-time, so the process can
 * still boot (e.g. for local dev without GitHub App credentials yet configured) and only
 * fails when a GitHub-dependent code path is actually hit.
 *
 * @octokit/app (v15+) ships as a pure ESM package, so it's loaded via dynamic import()
 * rather than require() — this file itself stays CommonJS, matching the rest of `apps/api`.
 */
async function getApp() {
  if (!appInstance) {
    if (!config.github.appId || !config.github.privateKey) {
      throw new Error(
        'GitHub App is not configured — set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY',
      );
    }

    const { App } = await import('@octokit/app');

    let privateKey = config.github.privateKey;
    if (
      privateKey &&
      !privateKey.includes('-----BEGIN') &&
      !privateKey.includes('-----BEGIN RSA')
    ) {
      try {
        privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
      } catch (err) {
        // ignore and fallback
      }
    }

    appInstance = new App({
      appId: config.github.appId,
      // Support the PEM being stored as a single env-var line with literal "\n" sequences
      privateKey: privateKey.replace(/\\n/g, '\n'),
    });
  }

  return appInstance;
}

/**
 * Returns an Octokit instance authenticated as the given installation (short-lived
 * installation access token, cached/refreshed internally by @octokit/app — ADR-007).
 * This is the only way the rest of the codebase should get a GitHub client.
 */
async function getInstallationOctokit(installationId) {
  const app = await getApp();
  return app.getInstallationOctokit(installationId);
}

/**
 * Returns a raw GitHub installation access token string for cloning or passing to external services.
 */
async function getInstallationToken(installationId) {
  const octokit = await getInstallationOctokit(installationId);
  const auth = await octokit.auth({ type: 'installation' });
  return auth.token;
}

module.exports = { getApp, getInstallationOctokit, getInstallationToken };
