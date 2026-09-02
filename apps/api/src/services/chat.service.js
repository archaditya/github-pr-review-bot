const db = require('../models');
const config = require('../config');
const logger = require('../utils/logger');
const chatQueries = require('../integrations/neo4j/chat-queries');

const MAX_USER_MESSAGE_LENGTH = 4000;

function formatGraphContext(intent, queryType, data) {
  const parts = [];

  if (data.overview) {
    const { schema, endpoints, classes, topFunctions } = data.overview;
    parts.push('### Repository Overview');
    if (schema?.nodeCounts?.length) {
      parts.push('**Node Counts:** ' + schema.nodeCounts.map((n) => `${n.label}: ${n.count}`).join(', '));
    }
    if (schema?.directories?.length) {
      parts.push('**Top Directories:** ' + schema.directories.map((d) => `${d.name} (${d.count} files)`).join(', '));
    }
    if (endpoints?.length) {
      parts.push('**API Endpoints:**\n' + endpoints.slice(0, 15).map((e) => `- \`${e.method || 'ROUTE'}\` \`${e.pathPattern || e.name}\` in \`${e.filePath || 'unknown'}\``).join('\n'));
    }
    if (classes?.length) {
      parts.push('**Key Classes:**\n' + classes.slice(0, 15).map((c) => `- \`${c.name}\` in \`${c.filePath || 'unknown'}\``).join('\n'));
    }
    if (topFunctions?.length) {
      parts.push('**Key Functions:**\n' + topFunctions.slice(0, 20).map((f) => `- \`${f.name}\` in \`${f.filePath || 'unknown'}\``).join('\n'));
    }
  }

  if (data.subgraph) {
    const { symbols, callers, callees, files } = data.subgraph;
    if (symbols?.length) {
      parts.push('### Matched Symbols in Knowledge Graph:');
      symbols.forEach((s) => {
        parts.push(`- **${s.label || 'Symbol'}** \`${s.name}\` (${s.fqn}) defined in \`${s.filePath || 'unknown'}:${s.startLine || 1}\``);
      });
    }
    if (callers?.length) {
      parts.push('### Callers (Who calls this code):');
      callers.slice(0, 15).forEach((c) => {
        parts.push(`- \`${c.name}\` in \`${c.filePath || 'unknown'}\` calls target symbol`);
      });
    }
    if (callees?.length) {
      parts.push('### Callees (What this code calls):');
      callees.slice(0, 15).forEach((c) => {
        parts.push(`- Calls \`${c.name}\` in \`${c.filePath || 'unknown'}\``);
      });
    }
    if (files?.length) {
      parts.push('### Relevant Source Files: ' + files.map((f) => `\`${f}\``).join(', '));
    }
  }

  return parts.join('\n\n');
}

async function createSession({ repositoryId, userId, title = 'New Chat' }) {
  const repository = await db.Repository.findByPk(repositoryId);
  if (!repository) {
    throw new Error('Repository not found');
  }

  const session = await db.ChatSession.create({
    repositoryId,
    userId,
    title: title.slice(0, 100),
  });

  return session;
}

async function listSessions({ repositoryId, userId }) {
  return db.ChatSession.findAll({
    where: { repositoryId, userId },
    order: [['updatedAt', 'DESC']],
    include: [
      {
        model: db.ChatMessage,
        as: 'messages',
        attributes: ['id', 'role', 'content', 'createdAt'],
        limit: 1,
        order: [['createdAt', 'DESC']],
      },
    ],
  });
}

async function getSessionWithMessages({ sessionId, userId }) {
  const session = await db.ChatSession.findOne({
    where: { id: sessionId, userId },
    include: [
      {
        model: db.ChatMessage,
        as: 'messages',
        order: [['createdAt', 'ASC']],
      },
    ],
  });

  if (!session) {
    throw new Error('Chat session not found');
  }

  return session;
}

async function deleteSession({ sessionId, userId }) {
  const session = await db.ChatSession.findOne({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new Error('Chat session not found');
  }

  await session.destroy();
  return { success: true };
}

async function streamMessage({ repositoryId, userId, sessionId, content, onToken, onComplete, onError }) {
  const startTime = Date.now();

  if (!content || !content.trim()) {
    throw new Error('Message content cannot be empty');
  }
  if (content.length > MAX_USER_MESSAGE_LENGTH) {
    throw new Error(`Message content exceeds limit of ${MAX_USER_MESSAGE_LENGTH} characters`);
  }

  // 1. Verify session exists and belongs to user & repository
  const session = await db.ChatSession.findOne({
    where: { id: sessionId, repositoryId, userId },
    include: [{ model: db.Repository, as: 'repository' }],
  });
  if (!session) {
    throw new Error('Chat session not found or unauthorized');
  }

  // 2. Persist user message to Postgres
  const userMsg = await db.ChatMessage.create({
    sessionId,
    role: 'user',
    content: content.trim(),
  });

  // Auto-update session title from first user message if still default
  if (session.title === 'New Chat') {
    const newTitle = content.trim().slice(0, 40) + (content.length > 40 ? '...' : '');
    await session.update({ title: newTitle });
  }

  // 3. Fast Intent Route check (greetings / smalltalk)
  const cleanInput = content.trim().toLowerCase();
  const isGreeting =
    cleanInput.startsWith('hi') ||
    cleanInput.startsWith('hello') ||
    cleanInput.startsWith('hey') ||
    cleanInput.startsWith('thanks') ||
    cleanInput.startsWith('thank you') ||
    cleanInput === 'who are you';

  let intent = 'semantic';
  let queryType = 'general';
  let graphContext = '';
  let citations = [];

  try {
    if (isGreeting) {
      intent = 'greeting';
      graphContext = 'User is engaging in casual greeting or smalltalk. Respond warmly, concisely, and offer help with this codebase.';
    } else {
      // 4. Schema summary & Intent classification via gpt-4o-mini
      const schemaSummary = await chatQueries.getRepoSchemaSummary(repositoryId);

      try {
        const classifyRes = await fetch(`${config.aiService.baseUrl}/chat/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: content, schema_summary: schemaSummary }),
          signal: AbortSignal.timeout(6000),
        });

        if (classifyRes.ok) {
          const classData = await classifyRes.json();
          intent = classData.intent || 'semantic';
          queryType = classData.query_type || 'general';

          // 5. Query graph according to intent
          if (intent === 'overview' || queryType === 'endpoints') {
            const overview = await chatQueries.getRepoOverview(repositoryId);
            graphContext = formatGraphContext(intent, queryType, { overview });
            citations = (overview.endpoints || []).slice(0, 5).map((e) => ({
              filePath: e.filePath,
              symbolFqn: e.fqn,
              label: 'APIEndpoint',
            }));
          } else {
            // Search symbols
            const terms = [...(classData.entities || []), ...(classData.file_hints || [])];
            let symbols = [];
            if (terms.length > 0) {
              symbols = await chatQueries.searchSymbols(repositoryId, terms, 15);
            }

            let subgraph = { symbols, callers: [], callees: [], files: [] };
            if (symbols.length > 0) {
              const fqns = symbols.map((s) => s.fqn);
              subgraph = await chatQueries.getSymbolSubgraph(repositoryId, fqns, {
                includeCallers: true,
                includeCallees: true,
              });
            } else {
              // Fallback to overview if no specific symbols detected
              const overview = await chatQueries.getRepoOverview(repositoryId);
              graphContext = formatGraphContext(intent, queryType, { overview });
            }

            if (subgraph.symbols?.length) {
              graphContext = formatGraphContext(intent, queryType, { subgraph });
              citations = subgraph.symbols.slice(0, 10).map((s) => ({
                filePath: s.filePath,
                symbolFqn: s.fqn,
                startLine: s.startLine,
                endLine: s.endLine,
                label: s.label,
              }));
            }
          }
        }
      } catch (classErr) {
        logger.warn({ err: classErr.message }, 'intent classification failed, fallback to overview');
        const overview = await chatQueries.getRepoOverview(repositoryId);
        graphContext = formatGraphContext(intent, queryType, { overview });
      }
    }

    // 6. Gather STM conversation history (last 10 messages)
    const recentMsgs = await db.ChatMessage.findAll({
      where: { sessionId },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    const historyTurns = recentMsgs
      .reverse()
      .filter((m) => m.id !== userMsg.id)
      .map((m) => ({ role: m.role, content: m.content }));

    // 7. Request SSE stream from ai-service /chat/generate
    const repoName = session.repository?.fullName || 'Repository';
    const genRes = await fetch(`${config.aiService.baseUrl}/chat/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: content,
        graph_context: graphContext,
        history: historyTurns,
        repo_name: repoName,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!genRes.ok) {
      throw new Error(`AI service generation failed with status ${genRes.status}`);
    }

    let fullAnswer = '';
    const reader = genRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.token) {
              fullAnswer += parsed.token;
              onToken(parsed.token);
            }
            if (parsed.error) {
              logger.error({ error: parsed.error }, 'stream error received from AI service');
            }
          } catch {}
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    // 8. Persist assistant message in Postgres
    const assistantMsg = await db.ChatMessage.create({
      sessionId,
      role: 'assistant',
      content: fullAnswer || "I'm sorry, I was unable to generate a response.",
      citations: citations.length ? citations : null,
      intent,
      modelUsed: 'gpt-4o',
      latencyMs,
    });

    await session.update({ updatedAt: new Date() });

    onComplete({
      id: assistantMsg.id,
      content: fullAnswer,
      citations,
      intent,
      latencyMs,
    });
  } catch (err) {
    logger.error({ err: err.message, sessionId, repositoryId }, 'chat pipeline stream error');
    onError(err);
  }
}

module.exports = {
  createSession,
  listSessions,
  getSessionWithMessages,
  deleteSession,
  streamMessage,
};
