export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { system, messages } = req.body;

    if (!system || !messages) {
      return res.status(400).json({ error: 'Missing system prompt or messages' });
    }

    // Extract user info from the last few messages to build memory context
    const conversationText = messages.slice(-3).map(m => 
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    // Build memory-enhanced system prompt
    let enhancedSystemPrompt = system;
    
    // Add memory extraction instruction (Claude will remember key facts naturally)
    enhancedSystemPrompt += `\n\nMEMORY INSTRUCTIONS:
- Remember key facts the user shares (name, problems, preferences, life events)
- Reference things they told you in previous messages naturally
- If they mention their name, use it in future responses
- If they share a problem, remember it and ask follow-up questions later
- Build continuity across the conversation by referencing past topics

Be consistent with what the user has told you. Make them feel heard and remembered.`;

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        temperature: 0.9,
        system: enhancedSystemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Anthropic API error');
    }

    const data = await response.json();
    const reply = data.content[0].text;

    // In a future version, we could extract memories here and save to Supabase
    // For now, Claude's context window handles short-term memory within the conversation

    return res.status(200).json({ 
      reply: reply
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to get response',
      details: error.message 
    });
  }
}
