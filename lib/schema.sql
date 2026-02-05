-- Memory System Database Schema for Mitr App
-- This stores key facts about users that AI companions remember

-- User Memory Table
CREATE TABLE IF NOT EXISTS user_memories (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  companion_id VARCHAR(50) NOT NULL,
  memory_type VARCHAR(50) NOT NULL, -- 'personal_info', 'problem', 'preference', 'life_event'
  memory_key VARCHAR(100) NOT NULL, -- 'name', 'job', 'relationship_status', etc.
  memory_value TEXT NOT NULL,
  importance INTEGER DEFAULT 5, -- 1-10, higher = more important
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_referenced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reference_count INTEGER DEFAULT 0
);

-- Indexes for fast lookups
CREATE INDEX idx_user_companion ON user_memories(user_id, companion_id);
CREATE INDEX idx_importance ON user_memories(importance DESC);
CREATE INDEX idx_last_referenced ON user_memories(last_referenced DESC);

-- Conversation Summary Table (stores summaries of past conversations)
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  companion_id VARCHAR(50) NOT NULL,
  conversation_date DATE NOT NULL,
  summary TEXT NOT NULL,
  mood VARCHAR(50), -- 'happy', 'sad', 'stressed', 'excited', etc.
  topics TEXT[], -- Array of topics discussed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conv_user_companion ON conversation_summaries(user_id, companion_id);
CREATE INDEX idx_conv_date ON conversation_summaries(conversation_date DESC);

-- Sample Data Structure:
-- user_memories example:
-- {
--   user_id: "user_123",
--   companion_id: "ahana",
--   memory_type: "personal_info",
--   memory_key: "name",
--   memory_value: "Rahul",
--   importance: 10
-- }
--
-- {
--   user_id: "user_123",
--   companion_id: "ahana", 
--   memory_type: "problem",
--   memory_key: "relationship_issue",
--   memory_value: "Girlfriend doesn't text back, feeling anxious about it",
--   importance: 8
-- }
