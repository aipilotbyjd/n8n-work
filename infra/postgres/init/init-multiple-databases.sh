#!/bin/bash
set -e

# Create multiple databases for N8N-Work services
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create orchestrator database
    CREATE DATABASE orchestrator;
    GRANT ALL PRIVILEGES ON DATABASE orchestrator TO $POSTGRES_USER;
    
    -- Create engine database
    CREATE DATABASE engine;
    GRANT ALL PRIVILEGES ON DATABASE engine TO $POSTGRES_USER;
    
    -- Create analytics database
    CREATE DATABASE analytics;
    GRANT ALL PRIVILEGES ON DATABASE analytics TO $POSTGRES_USER;
    
    -- Create extensions for all databases
    \c orchestrator;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    
    \c engine;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    
    \c analytics;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOSQL

echo "Multiple databases created successfully!"