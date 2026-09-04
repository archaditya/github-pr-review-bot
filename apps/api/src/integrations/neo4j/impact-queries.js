const { runQuery } = require('./client');
const logger = require('../../utils/logger');

/**
 * Given a list of changed file paths, find all symbols defined in those files
 * and their relationships (callers, callees, endpoints, tests).
 *
 * This is the core of the graph-powered impact analysis step in the review pipeline.
 */
async function analyzeImpact(repoId, changedFilePaths) {
  if (!changedFilePaths?.length) {
    return { changedSymbols: [], callers: [], callees: [], affectedEndpoints: [], relatedTests: [], affectedFilesCount: 0 };
  }

  try {
    // 1. Find all symbols defined in changed files
    const symbolsResult = await runQuery(
      `MATCH (sym)-[:DEFINED_IN]->(f:File {repo_id: $repoId})
       WHERE f.path IN $paths
       RETURN sym.fqn AS fqn, sym.name AS name, f.path AS file_path, labels(sym)[0] AS label`,
      { repoId, paths: changedFilePaths },
    );

    const changedSymbols = symbolsResult.map((r) => r.fqn);
    if (!changedSymbols.length) {
      return { changedSymbols: [], callers: [], callees: [], affectedEndpoints: [], relatedTests: [], affectedFilesCount: 0 };
    }

    // 2. Find callers of changed symbols (who calls this?)
    const callersResult = await runQuery(
      `MATCH (caller:Function)-[:CALLS]->(callee:Function)
       WHERE callee.repo_id = $repoId AND callee.fqn IN $fqns
         AND NOT caller.fqn IN $fqns
       MATCH (caller)-[:DEFINED_IN]->(f:File)
       RETURN DISTINCT caller.fqn AS fqn, caller.name AS name, f.path AS file_path
       LIMIT 30`,
      { repoId, fqns: changedSymbols },
    );

    // 3. Find callees of changed symbols (what does this call?)
    const calleesResult = await runQuery(
      `MATCH (caller:Function)-[:CALLS]->(callee:Function)
       WHERE caller.repo_id = $repoId AND caller.fqn IN $fqns
         AND NOT callee.fqn IN $fqns
       RETURN DISTINCT callee.fqn AS fqn
       LIMIT 30`,
      { repoId, fqns: changedSymbols },
    );

    // 4. Find affected API endpoints
    const endpointsResult = await runQuery(
      `MATCH (ep:APIEndpoint {repo_id: $repoId})
       WHERE ep.fqn IN $fqns
         OR EXISTS {
           MATCH (ep)-[:HANDLES_ROUTE]->(handler:Function)
           WHERE handler.fqn IN $fqns
         }
       RETURN DISTINCT ep.name AS name, ep.fqn AS fqn
       LIMIT 20`,
      { repoId, fqns: changedSymbols },
    );

    // 5. Find related test files (files that import or reference changed files)
    const testsResult = await runQuery(
      `MATCH (testFile:File {repo_id: $repoId})-[:IMPORTS]->(f:File {repo_id: $repoId})
       WHERE f.path IN $paths
         AND (testFile.path CONTAINS 'test' OR testFile.path CONTAINS 'spec' OR testFile.path CONTAINS '__tests__')
       RETURN DISTINCT testFile.path AS path
       LIMIT 20`,
      { repoId, paths: changedFilePaths },
    );

    // 6. Count total affected files (files containing callers)
    const affectedFilesResult = await runQuery(
      `MATCH (caller:Function)-[:CALLS]->(callee:Function)
       WHERE callee.repo_id = $repoId AND callee.fqn IN $fqns
       MATCH (caller)-[:DEFINED_IN]->(f:File)
       RETURN count(DISTINCT f.path) AS count`,
      { repoId, fqns: changedSymbols },
    );

    const impact = {
      changedSymbols: (changedSymbols || []).filter(Boolean),
      callers: (callersResult || [])
        .filter((r) => r && (r.fqn || r.name))
        .map((r) => ({
          fqn: r.fqn || '',
          name: r.name || r.fqn || '',
          file_path: r.file_path || '',
        })),
      callees: (calleesResult || []).map((r) => r.fqn).filter(Boolean),
      affectedEndpoints: (endpointsResult || []).map((r) => r.name || r.fqn).filter(Boolean),
      relatedTests: (testsResult || []).map((r) => r.path).filter(Boolean),
      affectedFilesCount: Number(affectedFilesResult[0]?.count?.toNumber?.() || affectedFilesResult[0]?.count || 0),
    };

    logger.info(
      { repoId, symbols: impact.changedSymbols.length, callers: impact.callers.length, endpoints: impact.affectedEndpoints.length },
      'impact analysis complete',
    );

    return impact;
  } catch (err) {
    logger.error({ err, repoId }, 'impact analysis failed — falling back to no-graph review');
    return { changedSymbols: [], callers: [], callees: [], affectedEndpoints: [], relatedTests: [], affectedFilesCount: 0 };
  }
}

/**
 * Check if a repository has an indexed graph.
 */
async function hasGraph(repoId) {
  try {
    const result = await runQuery(
      'MATCH (f:File {repo_id: $repoId}) RETURN count(f) AS count LIMIT 1',
      { repoId },
    );
    return (result[0]?.count?.toNumber?.() || result[0]?.count || 0) > 0;
  } catch {
    return false;
  }
}

module.exports = { analyzeImpact, hasGraph };
