#!/usr/bin/env python3
"""
Database migration utilities for Data Mirage.
"""

import os
import sys
import asyncio
import argparse
from pathlib import Path

# Add app directory to Python path
app_dir = Path(__file__).parent
sys.path.insert(0, str(app_dir))

from alembic.config import Config
from alembic import command
from core.config import settings
from core.database import init_database, close_database, check_database_connection


def get_alembic_config():
    """Get Alembic configuration."""
    alembic_cfg = Config(str(app_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(app_dir / "migrations"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url.replace("+asyncpg", ""))
    return alembic_cfg


async def check_db_connection():
    """Check database connection."""
    print("🔍 Checking database connection...")
    try:
        connected = await check_database_connection()
        if connected:
            print("✅ Database connection successful")
            return True
        else:
            print("❌ Database connection failed")
            return False
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False


def create_migration(message: str):
    """Create a new migration."""
    print(f"📝 Creating migration: {message}")
    try:
        alembic_cfg = get_alembic_config()
        command.revision(alembic_cfg, message=message, autogenerate=True)
        print("✅ Migration created successfully")
    except Exception as e:
        print(f"❌ Failed to create migration: {e}")
        sys.exit(1)


def run_migrations():
    """Run pending migrations."""
    print("🔄 Running database migrations...")
    try:
        alembic_cfg = get_alembic_config()
        command.upgrade(alembic_cfg, "head")
        print("✅ Migrations completed successfully")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)


def rollback_migration(revision: str = "-1"):
    """Rollback to a specific revision."""
    print(f"↩️  Rolling back to revision: {revision}")
    try:
        alembic_cfg = get_alembic_config()
        command.downgrade(alembic_cfg, revision)
        print("✅ Rollback completed successfully")
    except Exception as e:
        print(f"❌ Rollback failed: {e}")
        sys.exit(1)


def show_migration_history():
    """Show migration history."""
    print("📜 Migration history:")
    try:
        alembic_cfg = get_alembic_config()
        command.history(alembic_cfg, verbose=True)
    except Exception as e:
        print(f"❌ Failed to show history: {e}")
        sys.exit(1)


def show_current_revision():
    """Show current database revision."""
    print("📍 Current database revision:")
    try:
        alembic_cfg = get_alembic_config()
        command.current(alembic_cfg, verbose=True)
    except Exception as e:
        print(f"❌ Failed to show current revision: {e}")
        sys.exit(1)


async def init_db():
    """Initialize database with tables."""
    print("🏗️  Initializing database...")
    try:
        await init_database()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        sys.exit(1)
    finally:
        await close_database()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Data Mirage database migration utility")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Check connection
    subparsers.add_parser("check", help="Check database connection")
    
    # Initialize database
    subparsers.add_parser("init", help="Initialize database with tables")
    
    # Create migration
    create_parser = subparsers.add_parser("create", help="Create a new migration")
    create_parser.add_argument("message", help="Migration message")
    
    # Run migrations
    subparsers.add_parser("migrate", help="Run pending migrations")
    
    # Rollback
    rollback_parser = subparsers.add_parser("rollback", help="Rollback migration")
    rollback_parser.add_argument(
        "--revision", 
        default="-1", 
        help="Revision to rollback to (default: -1 for previous)"
    )
    
    # History
    subparsers.add_parser("history", help="Show migration history")
    
    # Current
    subparsers.add_parser("current", help="Show current database revision")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    print(f"🗄️  Data Mirage Database Migration Tool")
    print(f"📊 Environment: {settings.environment}")
    print(f"🔗 Database: {settings.database_url.split('@')[-1] if '@' in settings.database_url else 'Not configured'}")
    print("-" * 50)
    
    if args.command == "check":
        asyncio.run(check_db_connection())
    
    elif args.command == "init":
        asyncio.run(init_db())
    
    elif args.command == "create":
        create_migration(args.message)
    
    elif args.command == "migrate":
        # Check connection first
        if not asyncio.run(check_db_connection()):
            sys.exit(1)
        run_migrations()
    
    elif args.command == "rollback":
        rollback_migration(args.revision)
    
    elif args.command == "history":
        show_migration_history()
    
    elif args.command == "current":
        show_current_revision()


if __name__ == "__main__":
    main()