export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { conversationText, existingMemories } = req.body;

    if (!conversationText) {
      return res.status(400).json({ error: 'Missing conversationText' });
    }

    // Build the extraction prompt
    const existingContext = existingMemories && existingMemories.length > 0
      ? `\n\nALREADY KNOWN FACTS (update if new info contradicts these):\n${existingMemories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n')}`
      : '';

    const prompt = `Analyze this conversation and extract key facts to remember about the user. Focus on:

1. PERSONAL INFO: Name, age, location, job, relationship status, education
2. PROBLEMS: Current issues, concerns, anxieties they're facing  
3. PREFERENCES: Likes, dislikes, interests, hobbies
4. LIFE EVENTS: Important things happening in their life
5. EMOTIONAL STATE: How they're feeling, mood patterns
${existingContext}

Conversation:
${conversationText}

Return a JSON array of memories. Only extract CLEAR, SPECIFIC facts the user explicitly stated or strongly implied. Don't make assumptions.

Format:
[
  {"type": "personal_info", "key": "name", "value": "Rahul", "importance": 10},
  {"type": "problem", "key": "breakup", "value": "Recently broke up with girlfriend of 2 years", "importance": 8}
]

Valid types: personal_info, problem, preference, life_event, emotional_state
Importance: 1-10 (10 = most important, like their name)

Return ONLY the JSON array. If no clear facts found, return [].`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a memory extraction system. You analyze conversations and extract key facts about the user. Return ONLY valid JSON arrays. No markdown, no explanation.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI error:', errorData);
      throw new Error(errorData.error?.message || 'OpenAI error');
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    // Clean up response - remove markdown fences if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    const memories = JSON.parse(content);

    console.log(`Extracted ${memories.length} memories`);

    return res.status(200).json({ 
      success: true,
      memories: memories,
      count: memories.length
    });

  } catch (error) {
    console.error('Memory extraction error:', error.message);
    return res.status(500).json({ error: 'Failed to extract memories', details: error.message });
  }
}
