import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Extract memories from conversation using Claude
async function extractMemories(userId, companionId, conversationText) {
  const prompt = `Analyze this conversation and extract key facts to remember about the user. Focus on:

1. PERSONAL INFO: Name, age, location, job, relationship status
2. PROBLEMS: Current issues, concerns, anxieties they're facing
3. PREFERENCES: Likes, dislikes, interests, hobbies
4. LIFE EVENTS: Important things happening in their life

Conversation:
${conversationText}

Return a JSON array of memories in this format:
[
  {
    "type": "personal_info",
    "key": "name",
    "value": "Rahul",
    "importance": 10
  },
  {
    "type": "problem",
    "key": "relationship_anxiety",
    "value": "Worried that girlfriend doesn't reply to texts quickly",
    "importance": 8
  }
]

Only extract clear, specific facts. Don't make assumptions. Return ONLY the JSON array, nothing else.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const jsonText = response.content[0].text.trim();
    const memories = JSON.parse(jsonText);
    return memories;

  } catch (error) {
    console.error('Memory extraction error:', error);
    return [];
  }
}

// Save memories to database
async function saveMemories(userId, companionId, memories) {
  const client = await pool.connect();
  try {
    for (const memory of memories) {
      // Check if memory already exists
      const existing = await client.query(
        `SELECT id, reference_count FROM user_memories 
         WHERE user_id = $1 AND companion_id = $2 AND memory_key = $3`,
        [userId, companionId, memory.key]
      );

      if (existing.rows.length > 0) {
        // Update existing memory
        await client.query(
          `UPDATE user_memories 
           SET memory_value = $1, 
               importance = $2, 
               last_referenced = CURRENT_TIMESTAMP,
               reference_count = reference_count + 1
           WHERE id = $3`,
          [memory.value, memory.importance, existing.rows[0].id]
        );
      } else {
        // Insert new memory
        await client.query(
          `INSERT INTO user_memories 
           (user_id, companion_id, memory_type, memory_key, memory_value, importance)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, companionId, memory.type, memory.key, memory.value, memory.importance]
        );
      }
    }
  } finally {
    client.release();
  }
}

// Get relevant memories for current conversation
async function getRelevantMemories(userId, companionId, limit = 10) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT memory_type, memory_key, memory_value, importance
       FROM user_memories
       WHERE user_id = $1 AND companion_id = $2
       ORDER BY importance DESC, last_referenced DESC
       LIMIT $3`,
      [userId, companionId, limit]
    );

    return result.rows;
  } finally {
    client.release();
  }
}

// Format memories for AI context
function formatMemoriesForAI(memories) {
  if (memories.length === 0) return '';

  const grouped = {
    personal_info: [],
    problem: [],
    preference: [],
    life_event: []
  };

  memories.forEach(m => {
    grouped[m.memory_type]?.push(`- ${m.memory_key}: ${m.memory_value}`);
  });

  let context = '\n\nWHAT YOU KNOW ABOUT THIS USER:\n';
  
  if (grouped.personal_info.length > 0) {
    context += '\nPersonal Info:\n' + grouped.personal_info.join('\n');
  }
  if (grouped.problem.length > 0) {
    context += '\n\nCurrent Problems/Concerns:\n' + grouped.problem.join('\n');
  }
  if (grouped.preference.length > 0) {
    context += '\n\nPreferences/Interests:\n' + grouped.preference.join('\n');
  }
  if (grouped.life_event.length > 0) {
    context += '\n\nLife Events:\n' + grouped.life_event.join('\n');
  }

  context += '\n\nUse this information naturally in conversation. Reference things they told you before to show you remember and care.\n';

  return context;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Save memories after conversation
    try {
      const { userId, companionId, conversationText } = req.body;

      if (!userId || !companionId || !conversationText) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Extract memories from conversation
      const memories = await extractMemories(userId, companionId, conversationText);
      
      // Save to database
      await saveMemories(userId, companionId, memories);

      return res.status(200).json({ 
        success: true,
        memoriesExtracted: memories.length,
        memories 
      });

    } catch (error) {
      console.error('Memory save error:', error);
      return res.status(500).json({ error: 'Failed to save memories' });
    }

  } else if (req.method === 'GET') {
    // Retrieve memories for conversation context
    try {
      const { userId, companionId } = req.query;

      if (!userId || !companionId) {
        return res.status(400).json({ error: 'Missing userId or companionId' });
      }

      const memories = await getRelevantMemories(userId, companionId);
      const formattedContext = formatMemoriesForAI(memories);

      return res.status(200).json({
        memories,
        contextForAI: formattedContext,
        count: memories.length
      });

    } catch (error) {
      console.error('Memory retrieval error:', error);
      return res.status(500).json({ error: 'Failed to retrieve memories' });
    }

  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

export { 
  extractMemories, 
  saveMemories, 
  getRelevantMemories, 
  formatMemoriesForAI 
};
