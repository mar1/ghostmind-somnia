/**
 * GhostMind MCP Server - Production Version
 *
 * Privacy-First: Character name NEVER appears in any response.
 * All responses are: "ready", "yes", "no", "correct", "incorrect"
 *
 * Uses external LLM (Claude/OpenAI) for accurate question answering.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node server.mjs
 *   # or
 *   OPENAI_API_KEY=sk-... node server.mjs
 */

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { Redis } from '@upstash/redis';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE LAYER (Redis with in-memory fallback)
// ═══════════════════════════════════════════════════════════════════════════

let redis = null;
let useRedis = false;

// Initialize Redis if credentials are available
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    useRedis = true;
    console.log('✅ Redis (Upstash) connected');
  } catch (e) {
    console.warn('⚠️ Redis connection failed, using in-memory storage:', e.message);
  }
}

// In-memory fallback
const memoryGames = new Map();
const memoryCache = new Map();

// Game storage abstraction
const GameStore = {
  async get(gameId) {
    if (useRedis) {
      const data = await redis.hgetall(`game:${gameId}`);
      if (!data || Object.keys(data).length === 0) return null;
      return {
        character: data.character,
        difficulty: data.difficulty,
        questionCount: parseInt(data.questionCount) || 0,
        createdAt: parseInt(data.createdAt) || Date.now()
      };
    }
    return memoryGames.get(gameId) || null;
  },

  async set(gameId, game) {
    if (useRedis) {
      await redis.hset(`game:${gameId}`, {
        character: game.character,
        difficulty: game.difficulty,
        questionCount: game.questionCount.toString(),
        createdAt: game.createdAt.toString()
      });
      // Set TTL: 7 days (au cas où)
      await redis.expire(`game:${gameId}`, 604800);
    } else {
      memoryGames.set(gameId, game);
    }
  },

  async update(gameId, updates) {
    if (useRedis) {
      const updateData = {};
      for (const [key, value] of Object.entries(updates)) {
        updateData[key] = typeof value === 'number' ? value.toString() : value;
      }
      await redis.hset(`game:${gameId}`, updateData);
    } else {
      const game = memoryGames.get(gameId);
      if (game) {
        Object.assign(game, updates);
      }
    }
  },

  async has(gameId) {
    if (useRedis) {
      return await redis.exists(`game:${gameId}`) === 1;
    }
    return memoryGames.has(gameId);
  },

  async count() {
    if (useRedis) {
      const keys = await redis.keys('game:*');
      return keys.length;
    }
    return memoryGames.size;
  },

  async getAll() {
    if (useRedis) {
      const keys = await redis.keys('game:*');
      const games = [];
      for (const key of keys) {
        const gameId = key.replace('game:', '');
        const game = await this.get(gameId);
        if (game) games.push({ id: gameId, ...game });
      }
      return games;
    }
    const games = [];
    for (const [id, game] of memoryGames) {
      games.push({ id, ...game });
    }
    return games;
  }
};

// Answer cache abstraction
const AnswerCache = {
  async get(key) {
    if (useRedis) {
      return await redis.get(`cache:${key}`);
    }
    return memoryCache.get(key) || null;
  },

  async set(key, value) {
    if (useRedis) {
      // Cache for 1 hour
      await redis.setex(`cache:${key}`, 3600, value);
    } else {
      memoryCache.set(key, value);
    }
  }
};

const CHARACTERS = {
  easy: [
    "Albert Einstein", "Michael Jackson", "Cleopatra", "Leonardo da Vinci",
    "Napoleon Bonaparte", "Marilyn Monroe", "Elvis Presley", "Queen Elizabeth II",
    "William Shakespeare", "Abraham Lincoln", "Mahatma Gandhi", "Nelson Mandela",
    "Princess Diana", "Muhammad Ali", "Oprah Winfrey", "Walt Disney",
    "Charlie Chaplin", "Audrey Hepburn", "Bruce Lee", "Michael Jordan",
    "Madonna", "Bob Marley", "Freddie Mercury", "John Lennon",
    "Beethoven", "Mozart", "Picasso", "Vincent van Gogh",
    "Marie Curie", "Isaac Newton", "Galileo Galilei", "Charles Darwin",
    "Aristotle", "Julius Caesar", "Alexander the Great", "George Washington",
    "Winston Churchill", "Martin Luther King Jr", "Steve Jobs", "Elon Musk"
  ],
  medium: [
    "Ada Lovelace", "Nikola Tesla", "Frida Kahlo", "Alan Turing",
    "Coco Chanel", "Amelia Earhart", "Sigmund Freud", "Carl Jung",
    "Virginia Woolf", "Ernest Hemingway", "Agatha Christie", "Oscar Wilde",
    "Hedy Lamarr", "Grace Hopper", "Rachel Carson", "Jane Goodall",
    "Confucius", "Sun Tzu", "Marco Polo", "Genghis Khan"
  ],
  hard: [
    "Hypatia of Alexandria", "Ramanujan", "Emmy Noether", "Rosalind Franklin",
    "Lise Meitner", "Hildegard of Bingen", "Ibn Sina", "Al-Khwarizmi",
    "Murasaki Shikibu", "Ching Shih", "Mansa Musa", "Hatshepsut"
  ]
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalize(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTERNAL LLM FOR ANSWERING QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function askLLM(character, question) {
  const prompt = `You are answering a yes/no question about the famous person: ${character}

Question: ${question}

Instructions:
- Answer based on well-known, factual information about this person
- Consider their birthplace, nationality, profession, era, achievements, gender, etc.
- For nationality questions: consider where they were BORN or primarily associated with
- For "alive" questions: historical figures (before 1950) are generally not alive

Respond with ONLY "yes" or "no". Nothing else.`;

  // Try Anthropic first
  if (ANTHROPIC_API_KEY) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 10,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await response.json();
      const answer = data.content?.[0]?.text?.toLowerCase().trim();
      if (answer?.includes('yes')) return 'yes';
      if (answer?.includes('no')) return 'no';
      console.warn('⚠️ Unexpected LLM response:', answer);
      return 'no';
    } catch (e) {
      console.error('❌ Anthropic error:', e.message);
    }
  }

  // Try OpenAI
  if (OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 10,
          temperature: 0
        })
      });
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content?.toLowerCase().trim();
      if (answer?.includes('yes')) return 'yes';
      if (answer?.includes('no')) return 'no';
      console.warn('⚠️ Unexpected LLM response:', answer);
      return 'no';
    } catch (e) {
      console.error('❌ OpenAI error:', e.message);
    }
  }

  console.error('❌ No LLM API key configured!');
  return 'no';
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const TOOLS = [
  {
    name: "ghostmind",
    description: `Game master tool for GhostMind guessing game.

Actions:
- "init": Start a new game. I will pick a secret character. Params: gameId, difficulty (easy/medium/hard)
- "question": Player asks a yes/no question. Params: gameId, question
- "guess": Player guesses the character. Params: gameId, guess

After calling this tool, respond to the user with EXACTLY what I tell you to say.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["init", "question", "guess"],
          description: "The action to perform"
        },
        gameId: {
          type: "string",
          description: "Unique game identifier"
        },
        difficulty: {
          type: "string",
          enum: ["easy", "medium", "hard"],
          description: "Difficulty level (for init only)"
        },
        question: {
          type: "string",
          description: "The yes/no question (for question action)"
        },
        guess: {
          type: "string",
          description: "The character guess (for guess action)"
        }
      },
      required: ["action", "gameId"]
    }
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTION - CHARACTER NEVER IN RESPONSE
// ═══════════════════════════════════════════════════════════════════════════

async function executeTool(name, args) {
  if (name !== "ghostmind") {
    return { content: [{ type: "text", text: "Unknown tool" }] };
  }

  const { action, gameId, difficulty, question, guess } = args;
  const timestamp = new Date().toISOString();

  console.log(`\n[${timestamp}] 🔧 Action: ${action} | Game: ${gameId}`);

  // ─────────────────────────────────────────────────────────────────────────
  // INIT: Pick character, store privately, return ONLY "ready"
  // ─────────────────────────────────────────────────────────────────────────
  if (action === 'init') {
    // Check if game already exists (handle 3-agent subcommittee)
    if (await GameStore.has(gameId)) {
      console.log(`   ♻️ Game already exists, returning existing character`);
      console.log(`   📤 Response: "ready" (character NOT included)`);
      return {
        content: [{
          type: "text",
          text: "Character selected. Respond to the user with exactly: ready"
        }]
      };
    }

    const diff = difficulty || 'easy';
    const character = pickRandom(CHARACTERS[diff] || CHARACTERS.easy);

    await GameStore.set(gameId, {
      character,
      difficulty: diff,
      questionCount: 0,
      createdAt: Date.now()
    });

    console.log(`   ✅ Character selected (private): ${character}`);
    console.log(`   📤 Response: "ready" (character NOT included)`);

    // IMPORTANT: Character name NOT in response!
    return {
      content: [{
        type: "text",
        text: "Character selected. Respond to the user with exactly: ready"
      }]
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUESTION: Answer using external LLM, return ONLY "yes" or "no"
  // ─────────────────────────────────────────────────────────────────────────
  if (action === 'question') {
    const game = await GameStore.get(gameId);
    if (!game) {
      console.log(`   ❌ Game not found`);
      return { content: [{ type: "text", text: "Game not found. Respond: error" }] };
    }

    // Check cache for this question
    const cacheKey = `${gameId}:${question.toLowerCase().trim()}`;
    const cached = await AnswerCache.get(cacheKey);
    if (cached) {
      console.log(`   ♻️ Cached answer for: "${question}" → ${cached}`);
      return {
        content: [{
          type: "text",
          text: `Respond to the user with exactly: ${cached}`
        }]
      };
    }

    game.questionCount++;
    await GameStore.update(gameId, { questionCount: game.questionCount });

    console.log(`   ❓ Question #${game.questionCount}: "${question}"`);
    console.log(`   🤫 Character (private): ${game.character}`);

    // Ask external LLM
    const answer = await askLLM(game.character, question);

    // Cache the answer
    await AnswerCache.set(cacheKey, answer);

    console.log(`   📤 Response: "${answer}" (character NOT included)`);

    // IMPORTANT: Character name NOT in response!
    return {
      content: [{
        type: "text",
        text: `Respond to the user with exactly: ${answer}`
      }]
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GUESS: Compare server-side, return ONLY "correct" or "incorrect"
  // ─────────────────────────────────────────────────────────────────────────
  if (action === 'guess') {
    const game = await GameStore.get(gameId);
    if (!game) {
      console.log(`   ❌ Game not found`);
      return { content: [{ type: "text", text: "Game not found. Respond: error" }] };
    }

    const normalizedGuess = normalize(guess);
    const normalizedChar = normalize(game.character);

    // Flexible matching
    const isCorrect =
      normalizedGuess === normalizedChar ||
      normalizedChar.includes(normalizedGuess) ||
      normalizedGuess.includes(normalizedChar) ||
      // Match last name only (e.g., "Einstein" matches "Albert Einstein")
      normalizedChar.split(' ').some(part => part.length > 2 && normalizedGuess === part) ||
      normalizedGuess.split(' ').some(part => part.length > 2 && normalizedChar.includes(part));

    const result = isCorrect ? 'correct' : 'incorrect';

    console.log(`   🎯 Guess: "${guess}"`);
    console.log(`   🤫 Actual (private): ${game.character}`);
    console.log(`   📤 Response: "${result}" (character NOT included)`);

    if (isCorrect) {
      // Game over - could clean up
      console.log(`   🎉 WINNER!`);
    }

    // IMPORTANT: Character name NOT in response!
    return {
      content: [{
        type: "text",
        text: `Respond to the user with exactly: ${result}`
      }]
    };
  }

  return { content: [{ type: "text", text: "Unknown action" }] };
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP JSON-RPC ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/ghostmind', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;

  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id || null,
      error: { code: -32600, message: 'Invalid Request' }
    });
  }

  switch (method) {
    case 'initialize':
      console.log(`\n🤝 MCP Initialize`);
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'ghostmind-mcp', version: '2.0.0' },
          capabilities: { tools: {} }
        }
      });

    case 'notifications/initialized':
    case 'initialized':
      return res.json({ jsonrpc: '2.0', id, result: {} });

    case 'tools/list':
      console.log(`\n📋 Tools list requested`);
      return res.json({
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS }
      });

    case 'tools/call':
      const result = await executeTool(params?.name, params?.arguments || {});
      return res.json({ jsonrpc: '2.0', id, result });

    default:
      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG / ADMIN ENDPOINTS (protect in production!)
// ═══════════════════════════════════════════════════════════════════════════

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'GhostMind MCP Server',
    version: '2.0.0',
    endpoints: {
      mcp: 'POST /api/ghostmind',
      health: 'GET /health',
      admin: 'GET /admin/games'
    }
  });
});

app.get('/health', async (req, res) => {
  const gameCount = await GameStore.count();
  res.json({
    status: 'ok',
    version: '2.1.0',
    env: NODE_ENV,
    storage: useRedis ? 'redis' : 'memory',
    games: gameCount,
    llm: ANTHROPIC_API_KEY ? 'anthropic' : OPENAI_API_KEY ? 'openai' : 'none',
    adminProtected: !!ADMIN_SECRET
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (Protected)
// ═══════════════════════════════════════════════════════════════════════════

// Admin authentication middleware
function requireAdmin(req, res, next) {
  // In production, always require ADMIN_SECRET
  if (NODE_ENV === 'production' && !ADMIN_SECRET) {
    return res.status(503).json({
      error: 'Admin endpoints disabled',
      message: 'ADMIN_SECRET not configured in production'
    });
  }

  // If ADMIN_SECRET is set, require Bearer token
  if (ADMIN_SECRET) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Authorization: Bearer <token>'
      });
    }

    const token = auth.slice(7); // Remove 'Bearer '
    if (token !== ADMIN_SECRET) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid admin token'
      });
    }
  }

  // In development without ADMIN_SECRET, allow access (with warning)
  if (!ADMIN_SECRET && NODE_ENV !== 'production') {
    console.warn('⚠️  Admin endpoint accessed without ADMIN_SECRET (dev mode)');
  }

  next();
}

app.get('/admin/games', requireAdmin, async (req, res) => {
  const list = await GameStore.getAll();
  res.json({
    count: list.length,
    games: list
  });
});

app.get('/admin/games/:gameId', requireAdmin, async (req, res) => {
  const game = await GameStore.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Not found' });
  res.json({ gameId: req.params.gameId, ...game });
});

// Admin: manually delete a game
app.delete('/admin/games/:gameId', requireAdmin, async (req, res) => {
  const gameId = req.params.gameId;
  const exists = await GameStore.has(gameId);
  if (!exists) return res.status(404).json({ error: 'Not found' });

  if (useRedis) {
    await redis.del(`game:${gameId}`);
  } else {
    memoryGames.delete(gameId);
  }

  res.json({ success: true, deleted: gameId });
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, async () => {
  // Test Redis connection if configured
  if (useRedis) {
    try {
      await redis.ping();
      console.log('✅ Redis connection verified');
    } catch (e) {
      console.warn('⚠️ Redis ping failed, falling back to memory:', e.message);
      useRedis = false;
    }
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           GhostMind MCP Server v2.1 (Privacy-First)           ║
╚═══════════════════════════════════════════════════════════════╝

🔐 Character names NEVER appear in MCP responses
📤 All responses: "ready", "yes", "no", "correct", "incorrect"

💾 Storage: ${useRedis ? 'Redis (Upstash) ✅ persistent' : '⚠️  In-Memory (data lost on restart)'}
🤖 LLM: ${ANTHROPIC_API_KEY ? 'Anthropic Claude ✅' : OPENAI_API_KEY ? 'OpenAI GPT ✅' : '❌ NOT CONFIGURED'}
🛡️  Admin: ${ADMIN_SECRET ? 'Protected ✅' : NODE_ENV === 'production' ? '❌ DISABLED (no secret)' : '⚠️  Open (dev mode)'}
🌍 Env: ${NODE_ENV}

📡 Endpoint: http://localhost:${PORT}/api/ghostmind
🏥 Health:   http://localhost:${PORT}/health

${!useRedis ? '💡 Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistence\n' : ''}${!ANTHROPIC_API_KEY && !OPENAI_API_KEY ? '⚠️  Set ANTHROPIC_API_KEY or OPENAI_API_KEY for question answering!\n' : ''}${!ADMIN_SECRET ? '💡 Set ADMIN_SECRET to protect /admin/* endpoints\n' : ''}
Ready for Somnia inferToolsChat calls!
`);
});
