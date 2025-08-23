# N8N-Work PostgreSQL Database Access Guide

## 🚀 Quick Start - Immediate Access

Since network connectivity is preventing Docker image downloads, here are **working solutions** you can use right now:

### Option 1: PowerShell Database Manager (Windows)
```powershell
# Navigate to your project directory
cd "c:\laragon\www\n8n-work"

# Run the database access script
.\scripts\db-access.ps1
```

### Option 2: Direct Command Line Access
```bash
# List all databases
docker exec -t n8n-work-postgres psql -U n8n_work -c "\l"

# Connect to main database
docker exec -it n8n-work-postgres psql -U n8n_work -d n8n_work

# Quick database info
docker exec -t n8n-work-postgres psql -U n8n_work -d n8n_work -c "SELECT current_database(), current_user, version();"
```

### Option 3: One-Line Database Queries
```bash
# Check database sizes
docker exec -t n8n-work-postgres psql -U n8n_work -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) as size FROM pg_database WHERE datistemplate = false;"

# Show active connections
docker exec -t n8n-work-postgres psql -U n8n_work -c "SELECT datname, usename, application_name, state FROM pg_stat_activity WHERE state = 'active';"

# List tables in n8n_work database
docker exec -t n8n-work-postgres psql -U n8n_work -d n8n_work -c "\dt"
```

## 📊 Database Connection Details

- **Host**: localhost (from outside Docker) or postgres (from within Docker network)
- **Port**: 5432
- **Username**: n8n_work
- **Password**: n8n_work_dev
- **Available Databases**:
  - `n8n_work` - Main application database
  - `orchestrator` - Orchestrator service database
  - `engine` - Engine service database
  - `analytics` - Analytics database

## 🔧 External Database Clients

You can connect using any PostgreSQL client with the above credentials:

### Popular Options:
1. **pgAdmin 4** (Desktop) - Download from pgadmin.org
2. **DBeaver** - Free, cross-platform database tool
3. **VS Code** with PostgreSQL extension
4. **DataGrip** (JetBrains IDE)
5. **Azure Data Studio** with PostgreSQL extension

### Quick Setup for DBeaver:
1. Download DBeaver Community Edition
2. Create new connection → PostgreSQL
3. Host: localhost, Port: 5432
4. Database: n8n_work, User: n8n_work, Password: n8n_work_dev

## 🔍 Useful SQL Commands

```sql
-- Show all databases
\l

-- Connect to a specific database
\c database_name

-- Show all tables
\dt

-- Describe table structure
\d table_name

-- Show table data
SELECT * FROM table_name LIMIT 10;

-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Show running queries
SELECT query, state, query_start FROM pg_stat_activity WHERE state = 'active';
```

## 🛠️ Common Tasks

### Backup Database
```bash
# Backup to file
docker exec n8n-work-postgres pg_dump -U n8n_work n8n_work > backup.sql

# Restore from file
docker exec -i n8n-work-postgres psql -U n8n_work n8n_work < backup.sql
```

### Monitor Performance
```bash
# Check slow queries
docker exec -t n8n-work-postgres psql -U n8n_work -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check table sizes
docker exec -t n8n-work-postgres psql -U n8n_work -d n8n_work -c "SELECT schemaname,tablename,pg_size_pretty(pg_total_relation_size(tablename::text)) as size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(tablename::text) DESC;"
```

## 🔄 Alternative Web Interface (Future)

When network connectivity improves, you can add a web interface by:

1. Using a VPN or different network
2. Pre-downloading Docker images on another machine
3. Using alternative container registries
4. Building a custom lightweight web interface

## 🆘 Troubleshooting

### If database connection fails:
```bash
# Check if PostgreSQL container is running
docker ps | findstr postgres

# Check PostgreSQL logs
docker logs n8n-work-postgres

# Test network connectivity
docker exec -t n8n-work-postgres pg_isready -U n8n_work

# Restart PostgreSQL if needed
docker-compose restart postgres
```

### If commands don't work:
1. Ensure Docker is running
2. Verify container names: `docker ps`
3. Check if you're in the right directory
4. Try using `docker-compose exec` instead of `docker exec`

---

**✅ Recommended Approach**: Start with the PowerShell script (`.\scripts\db-access.ps1`) for an interactive menu-driven experience, or use direct command line access for quick queries.