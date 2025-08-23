#!/bin/bash

# PostgreSQL Database Access Script for N8N-Work
# This script provides easy access to your PostgreSQL databases

echo "=========================================="
echo "N8N-Work PostgreSQL Database Access"
echo "=========================================="
echo ""

# Function to display menu
show_menu() {
    echo "Choose an option:"
    echo "1. List all databases"
    echo "2. Connect to n8n_work database"
    echo "3. Connect to orchestrator database"
    echo "4. Connect to engine database"
    echo "5. Connect to analytics database"
    echo "6. Show database sizes"
    echo "7. Show active connections"
    echo "8. Exit"
    echo ""
    read -p "Enter your choice (1-8): " choice
}

# Function to execute SQL commands
execute_sql() {
    local database=$1
    local command=$2
    docker exec -it n8n-work-postgres psql -U n8n_work -d "$database" -c "$command"
}

# Function to connect interactively
connect_interactive() {
    local database=$1
    echo "Connecting to $database database..."
    echo "Type 'exit' or press Ctrl+D to return to menu"
    docker exec -it n8n-work-postgres psql -U n8n_work -d "$database"
}

# Main menu loop
while true; do
    show_menu
    
    case $choice in
        1)
            echo "Listing all databases..."
            execute_sql "postgres" "\l"
            echo ""
            ;;
        2)
            connect_interactive "n8n_work"
            ;;
        3)
            connect_interactive "orchestrator"
            ;;
        4)
            connect_interactive "engine"
            ;;
        5)
            connect_interactive "analytics"
            ;;
        6)
            echo "Database sizes:"
            execute_sql "postgres" "SELECT datname, pg_size_pretty(pg_database_size(datname)) as size FROM pg_database WHERE datistemplate = false ORDER BY pg_database_size(datname) DESC;"
            echo ""
            ;;
        7)
            echo "Active connections:"
            execute_sql "postgres" "SELECT datname, usename, application_name, client_addr, state, query_start FROM pg_stat_activity WHERE state = 'active';"
            echo ""
            ;;
        8)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid option. Please try again."
            echo ""
            ;;
    esac
done