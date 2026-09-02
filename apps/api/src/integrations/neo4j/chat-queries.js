const { runQuery } = require('./client');
const logger = require('../../utils/logger');

/**
 * Chat-specific Cypher query layer.
 * All queries are read-only and explicitly scoped to repoId.
 */

async function getRepoSchemaSummary(repoId) {
  try {
    const nodeCountsResult = await runQuery(
      `MATCH (n {repo_id: $repoId})
       WITH labels(n)[0] AS label, count(n) AS count
       RETURN label, count
       ORDER BY count DESC`,
      { repoId },
    );

    const dirResult = await runQuery(
      `MATCH (f:File {repo_id: $repoId})
       WITH split(f.path, '/')[0] AS top_dir, count(f) AS file_count
       RETURN top_dir, file_count
       ORDER BY file_count DESC
       LIMIT 15`,
      { repoId },
    );

    return {
      nodeCounts: nodeCountsResult.map((r) => ({ label: r.label, count: r.count?.toNumber?.() || r.count })),
      directories: dirResult.map((r) => ({ name: r.top_dir, count: r.file_count?.toNumber?.() || r.file_count })),
    };
  } catch (err) {
    logger.warn({ err: err.message, repoId }, 'failed to fetch repo schema summary');
    return { nodeCounts: [], directories: [] };
  }
}

async function searchSymbols(repoId, terms, limit = 20) {
  if (!terms || !terms.length) return [];

  try {
    // Escape single quotes in terms to prevent Cypher syntax errors
    const safeTerms = terms.slice(0, 6).map((t) => t.replace(/'/g, "\\'"));
    const conditions = safeTerms
      .map((t) => `toLower(n.name) CONTAINS toLower('${t}') OR toLower(n.fqn) CONTAINS toLower('${t}')`)
      .join(' OR ');

    const query = `
      MATCH (n {repo_id: $repoId})
      WHERE (${conditions}) AND NOT n:File
      OPTIONAL MATCH (n)-[:DEFINED_IN]->(f:File)
      RETURN n.name AS name,
             n.fqn AS fqn,
             labels(n)[0] AS label,
             n.start_line AS start_line,
             n.end_line AS end_line,
             f.path AS file_path
      LIMIT $limit
    `;

    const records = await runQuery(query, { repoId, limit });
    return records.map((r) => ({
      name: r.name,
      fqn: r.fqn,
      label: r.label,
      startLine: r.start_line?.toNumber?.() || r.start_line,
      endLine: r.end_line?.toNumber?.() || r.end_line,
      filePath: r.file_path,
    }));
  } catch (err) {
    logger.error({ err: err.message, repoId, terms }, 'symbol search failed');
    return [];
  }
}

async function getSymbolSubgraph(repoId, fqns, { includeCallers = true, includeCallees = true } = {}) {
  if (!fqns || !fqns.length) return { symbols: [], callers: [], callees: [], files: [] };

  try {
    const symsResult = await runQuery(
      `MATCH (n {repo_id: $repoId})
       WHERE n.fqn IN $fqns
       OPTIONAL MATCH (n)-[:DEFINED_IN]->(f:File)
       RETURN n.name AS name, n.fqn AS fqn, labels(n)[0] AS label,
              n.start_line AS start_line, n.end_line AS end_line,
              f.path AS file_path`,
      { repoId, fqns },
    );

    let callers = [];
    if (includeCallers) {
      const callersResult = await runQuery(
        `MATCH (caller)-[:CALLS]->(callee {repo_id: $repoId})
         WHERE callee.fqn IN $fqns AND NOT caller.fqn IN $fqns
         OPTIONAL MATCH (caller)-[:DEFINED_IN]->(f:File)
         RETURN DISTINCT caller.name AS name, caller.fqn AS fqn,
                labels(caller)[0] AS label, f.path AS file_path
         LIMIT 25`,
        { repoId, fqns },
      );
      callers = callersResult.map((r) => ({
        name: r.name,
        fqn: r.fqn,
        label: r.label,
        filePath: r.file_path,
      }));
    }

    let callees = [];
    if (includeCallees) {
      const calleesResult = await runQuery(
        `MATCH (caller {repo_id: $repoId})-[:CALLS]->(callee)
         WHERE caller.fqn IN $fqns AND NOT callee.fqn IN $fqns
         OPTIONAL MATCH (callee)-[:DEFINED_IN]->(f:File)
         RETURN DISTINCT callee.name AS name, callee.fqn AS fqn,
                labels(callee)[0] AS label, f.path AS file_path
         LIMIT 25`,
        { repoId, fqns },
      );
      callees = calleesResult.map((r) => ({
        name: r.name,
        fqn: r.fqn,
        label: r.label,
        filePath: r.file_path,
      }));
    }

    const symbols = symsResult.map((r) => ({
      name: r.name,
      fqn: r.fqn,
      label: r.label,
      startLine: r.start_line?.toNumber?.() || r.start_line,
      endLine: r.end_line?.toNumber?.() || r.end_line,
      filePath: r.file_path,
    }));

    const fileSet = new Set();
    [...symbols, ...callers, ...callees].forEach((item) => {
      if (item.filePath) fileSet.add(item.filePath);
    });

    return { symbols, callers, callees, files: Array.from(fileSet) };
  } catch (err) {
    logger.error({ err: err.message, repoId }, 'getSymbolSubgraph failed');
    return { symbols: [], callers: [], callees: [], files: [] };
  }
}

async function getEndpoints(repoId) {
  try {
    const result = await runQuery(
      `MATCH (ep:APIEndpoint {repo_id: $repoId})
       OPTIONAL MATCH (ep)-[:DEFINED_IN]->(f:File)
       RETURN ep.name AS name, ep.fqn AS fqn, ep.method AS method,
              ep.path_pattern AS path_pattern, f.path AS file_path
       ORDER BY ep.path_pattern
       LIMIT 50`,
      { repoId },
    );

    return result.map((r) => ({
      name: r.name,
      fqn: r.fqn,
      method: r.method,
      pathPattern: r.path_pattern,
      filePath: r.file_path,
    }));
  } catch (err) {
    logger.error({ err: err.message, repoId }, 'getEndpoints failed');
    return [];
  }
}

async function getRepoOverview(repoId) {
  try {
    const schema = await getRepoSchemaSummary(repoId);
    const endpoints = await getEndpoints(repoId);

    const classesResult = await runQuery(
      `MATCH (c:Class {repo_id: $repoId})
       OPTIONAL MATCH (c)-[:DEFINED_IN]->(f:File)
       RETURN c.name AS name, c.fqn AS fqn, f.path AS file_path
       ORDER BY c.name
       LIMIT 25`,
      { repoId },
    );

    const functionsResult = await runQuery(
      `MATCH (fn:Function {repo_id: $repoId})
       WHERE NOT (fn)<-[:CONTAINS]-(:Class)
       OPTIONAL MATCH (fn)-[:DEFINED_IN]->(f:File)
       RETURN fn.name AS name, fn.fqn AS fqn, f.path AS file_path
       ORDER BY fn.name
       LIMIT 30`,
      { repoId },
    );

    return {
      schema,
      endpoints,
      classes: classesResult.map((r) => ({ name: r.name, fqn: r.fqn, filePath: r.file_path })),
      topFunctions: functionsResult.map((r) => ({ name: r.name, fqn: r.fqn, filePath: r.file_path })),
    };
  } catch (err) {
    logger.error({ err: err.message, repoId }, 'getRepoOverview failed');
    return { schema: { nodeCounts: [], directories: [] }, endpoints: [], classes: [], topFunctions: [] };
  }
}

module.exports = {
  getRepoSchemaSummary,
  searchSymbols,
  getSymbolSubgraph,
  getEndpoints,
  getRepoOverview,
};
