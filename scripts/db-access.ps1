# PostgreSQL Database Access Script for N8N-Work (PowerShell)
# This script provides easy access to your PostgreSQL databases

Write-Host "==========================================" -ForegroundColor Green
Write-Host "N8N-Work PostgreSQL Database Access" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

function Show-Menu {
    Write-Host "Choose an option:" -ForegroundColor Yellow
    Write-Host "1. List all databases"
    Write-Host "2. Connect to n8n_work database"
    Write-Host "3. Connect to orchestrator database"
    Write-Host "4. Connect to engine database"
    Write-Host "5. Connect to analytics database"
    Write-Host "6. Show database sizes"
    Write-Host "7. Show active connections"
    Write-Host "8. Show table information"
    Write-Host "9. Backup database"
    Write-Host "0. Exit"
    Write-Host ""
    $choice = Read-Host "Enter your choice (0-9)"
    return $choice
}

function Execute-SQL {
    param(
        [string]$Database,
        [string]$Command
    )
    docker exec -it n8n-work-postgres psql -U n8n_work -d $Database -c $Command
}

function Connect-Interactive {
    param([string]$Database)
    Write-Host "Connecting to ${Database} database..." -ForegroundColor Cyan
    Write-Host "Type '\q' to exit the PostgreSQL session" -ForegroundColor Yellow
    docker exec -it n8n-work-postgres psql -U n8n_work -d $Database
}

function Show-Tables {
    param([string]$Database)
    Write-Host "Tables in ${Database}:" -ForegroundColor Cyan
    Execute-SQL -Database $Database -Command "\dt"
}

function Backup-Database {
    param([string]$Database)
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "backup_${Database}_${timestamp}.sql"
    Write-Host "Creating backup of ${Database} to ${backupFile}..." -ForegroundColor Cyan
    docker exec n8n-work-postgres pg_dump -U n8n_work $Database > $backupFile
    Write-Host "Backup completed: ${backupFile}" -ForegroundColor Green
}

# Main menu loop
do {
    $choice = Show-Menu
    
    switch ($choice) {
        "1" {
            Write-Host "Listing all databases..." -ForegroundColor Cyan
            Execute-SQL -Database "postgres" -Command "\l"
            Write-Host ""
        }
        "2" { Connect-Interactive -Database "n8n_work" }
        "3" { Connect-Interactive -Database "orchestrator" }
        "4" { Connect-Interactive -Database "engine" }
        "5" { Connect-Interactive -Database "analytics" }
        "6" {
            Write-Host "Database sizes:" -ForegroundColor Cyan
            Execute-SQL -Database "postgres" -Command "SELECT datname, pg_size_pretty(pg_database_size(datname)) as size FROM pg_database WHERE datistemplate = false ORDER BY pg_database_size(datname) DESC;"
            Write-Host ""
        }
        "7" {
            Write-Host "Active connections:" -ForegroundColor Cyan
            Execute-SQL -Database "postgres" -Command "SELECT datname, usename, application_name, client_addr, state, query_start FROM pg_stat_activity WHERE state = 'active';"
            Write-Host ""
        }
        "8" {
            $db = Read-Host "Enter database name (n8n_work, orchestrator, engine, analytics)"
            Show-Tables -Database $db
            Write-Host ""
        }
        "9" {
            $db = Read-Host "Enter database name to backup (n8n_work, orchestrator, engine, analytics)"
            Backup-Database -Database $db
            Write-Host ""
        }
        "0" {
            Write-Host "Goodbye!" -ForegroundColor Green
            break
        }
        default {
            Write-Host "Invalid option. Please try again." -ForegroundColor Red
            Write-Host ""
        }
    }
} while ($choice -ne "0")