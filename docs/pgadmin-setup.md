# Database Management for N8N-Work PostgreSQL

## Overview
This document provides multiple options for accessing and managing your PostgreSQL databases in the N8N-Work application.

## Database Access Options

### Option 1: Direct PostgreSQL Connection
- **Host**: localhost (or postgres from within Docker network)
- **Port**: 5432
- **Databases**: n8n_work, orchestrator, engine, analytics
- **Username**: n8n_work
- **Password**: n8n_work_dev

### Option 2: Using psql Command Line (Recommended)
You can use the PostgreSQL command line client directly:

```bash
# Connect to main database
docker exec -it n8n-work-postgres psql -U n8n_work -d n8n_work

# Connect to orchestrator database
docker exec -it n8n-work-postgres psql -U n8n_work -d orchestrator

# Connect to engine database
docker exec -it n8n-work-postgres psql -U n8n_work -d engine

# Connect to analytics database
docker exec -it n8n-work-postgres psql -U n8n_work -d analytics
```

### Option 3: Using Docker Compose exec
```bash
# Connect to PostgreSQL container
docker-compose exec postgres psql -U n8n_work -d n8n_work

# List all databases
docker-compose exec postgres psql -U n8n_work -c "\l"

# List all tables in n8n_work database
docker-compose exec postgres psql -U n8n_work -d n8n_work -c "\dt"
```

### Option 4: Using External Database Clients
You can use any PostgreSQL client with these connection details:
- **Host**: localhost
- **Port**: 5432
- **Database**: n8n_work (or orchestrator, engine, analytics)
- **Username**: n8n_work
- **Password**: n8n_work_dev

Popular clients include:
- pgAdmin 4 (desktop version)
- DBeaver
- DataGrip
- VS Code with PostgreSQL extension
- TablePlus
- Postico (macOS)

### Option 5: Future Web Interface
To add a web-based interface (when network connectivity is available):

```yaml
# Add to docker-compose.yml
adminer:
  image: adminer:latest
  container_name: n8n-work-adminer
  environment:
    ADMINER_DEFAULT_SERVER: postgres
    ADMINER_DESIGN: pepa-linha
  ports:
    - "8081:8080"
  depends_on:
    postgres:
      condition: service_healthy
  networks:
    - n8n-work
  restart: unless-stopped
```

## Quick Database Commands

```bash
# View database size
docker exec -it n8n-work-postgres psql -U n8n_work -d n8n_work -c "SELECT pg_size_pretty(pg_database_size('n8n_work'));"

# View table sizes
docker exec -it n8n-work-postgres psql -U n8n_work -d n8n_work -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text)) as size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(tablename::text) DESC;"

# View active connections
docker exec -it n8n-work-postgres psql -U n8n_work -d n8n_work -c "SELECT * FROM pg_stat_activity;"

# Backup database
docker exec -it n8n-work-postgres pg_dump -U n8n_work n8n_work > backup.sql

# Restore database
docker exec -i n8n-work-postgres psql -U n8n_work n8n_work < backup.sql
```

## Example SQL Queries
```sql
-- View all tables in current database
\dt

-- Describe table structure
\d table_name

-- View table data
SELECT * FROM table_name LIMIT 10;

-- Check database connections
SELECT datname, usename, application_name, client_addr, state 
FROM pg_stat_activity 
WHERE datname = 'n8n_work';
```

## Troubleshooting
- Ensure PostgreSQL is running: `docker-compose ps postgres`
- Check PostgreSQL logs: `docker-compose logs postgres`
- Verify port 5432 is accessible: `telnet localhost 5432`
- Test connection: `docker exec -it n8n-work-postgres psql -U n8n_work -d n8n_work -c "SELECT version();"`
- Check database exists: `docker exec -it n8n-work-postgres psql -U n8n_work -c "\l"`

## Security Notes
- Default credentials are for development only
- Change passwords in production environments
- Use environment variables for configuration
- Consider network isolation for production deployments