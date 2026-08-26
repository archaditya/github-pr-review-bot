const neo4j = require('neo4j-driver');
const config = require('../../config');
const logger = require('../../utils/logger');

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://neo4j:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'changeme';

let driver = null;

function getDriver() {
  if (!driver) {
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
    logger.info({ uri: NEO4J_URI }, 'neo4j driver created');
  }
  return driver;
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Run a read-only Cypher query and return records as plain objects.
 */
async function runQuery(cypher, params = {}) {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

module.exports = { getDriver, closeDriver, runQuery };
