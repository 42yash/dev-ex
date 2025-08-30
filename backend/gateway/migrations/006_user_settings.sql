-- Migration: Add user settings column
-- Description: Adds a JSONB column to store user preferences and settings
-- Date: 2025-08-29

-- Add settings column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='users' AND column_name='settings'
    ) THEN
        ALTER TABLE users ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create index for settings queries
CREATE INDEX IF NOT EXISTS idx_users_settings ON users USING GIN (settings);

-- Update existing users with default settings
UPDATE users 
SET settings = '{
    "theme": "auto",
    "language": "en",
    "aiModel": "gemini",
    "temperature": 0.7,
    "maxTokens": 2048,
    "enableLocalDocs": true,
    "enableWebSearch": true,
    "enableCustomSources": false,
    "customSettings": {}
}'::jsonb
WHERE settings IS NULL OR settings = '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN users.settings IS 'User preferences and configuration settings stored as JSONB';