-- Create relays database if it doesn't exist
SELECT 'CREATE DATABASE relays'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'relays')\gexec

-- Create jsinfo database if it doesn't exist
SELECT 'CREATE DATABASE jsinfo'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'jsinfo')\gexec

-- Grants are idempotent, safe to run multiple times
GRANT ALL PRIVILEGES ON DATABASE relays TO jsinfo;
GRANT ALL PRIVILEGES ON DATABASE jsinfo TO jsinfo;