"""CLI entry point for PyTodo."""

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(
        prog="pytodo", description="PyTodo - Personal Task Manager"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # pytodo runserver
    run_parser = subparsers.add_parser("runserver", help="Start the web server")
    run_parser.add_argument("--host", default=None, help="Bind address (default: 127.0.0.1)")
    run_parser.add_argument("--port", type=int, default=None, help="Port (default: 5000)")
    run_parser.add_argument("--debug", action="store_true", help="Enable debug mode")

    # pytodo init-db
    subparsers.add_parser("init-db", help="Initialize the database")

    args = parser.parse_args()

    if args.command == "runserver":
        from pytodo.app import create_app

        app = create_app()
        host = args.host or app.config.get("HOST", "127.0.0.1")
        port = args.port or app.config.get("PORT", 5000)
        debug = args.debug or app.config.get("DEBUG", False)
        app.run(host=host, port=port, debug=debug)

    elif args.command == "init-db":
        from pytodo.app import create_app
        from pytodo.db import init_db

        app = create_app()
        with app.app_context():
            init_db(app)
        print("Database initialized successfully.")

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
