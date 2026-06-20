# PyTodo - Personal Task Manager

A self-hosted personal task manager with sharing capabilities, installable as a PWA on mobile and desktop.

## Features

- 📝 **Task Management**: Create, edit, delete tasks with status tracking, deadlines, and notes
- 🔐 **User Accounts**: Register and login with secure password hashing (PBKDF2)
- 👤 **Guest Mode**: Use without creating an account
- 🔗 **Share Links**: Generate short share URLs for collaboration
- 📱 **PWA**: Install on your phone or desktop for a native app experience
- 📶 **Offline Support**: Works offline via service worker caching
- 🎯 **Progress Tracking**: Time-based progress bars and deadline warnings
- 🔍 **Filters & Sort**: Filter by status, sort by deadline/creation/status

## Quick Start

```bash
# Install
pip install -e .

# Start the server
pytodo runserver

# Or without installing:
python run.py
```

Then open `http://127.0.0.1:5000` in your browser.

## Usage

### Command Line

```bash
pytodo runserver              # Start on default http://127.0.0.1:5000
pytodo runserver --port 8080  # Custom port
pytodo runserver --host 0.0.0.0 --port 8080  # Accessible on LAN
pytodo init-db                # Initialize database
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PYTODO_SECRET_KEY` | auto-generated | JWT signing secret |
| `PYTODO_DATABASE` | `~/.pytodo/pytodo.db` | SQLite path |
| `PYTODO_HOST` | `127.0.0.1` | Bind address |
| `PYTODO_PORT` | `5000` | Port number |
| `PYTODO_JWT_EXPIRY_DAYS` | `30` | Session duration |

### Sharing Tasks

1. Create some tasks
2. Click **🔗 Copy Share Link**
3. Send the link to anyone
4. They open the link and see the same task list (no login required)

### Installing as a PWA

- **Desktop Chrome/Edge**: Click the install icon in the address bar
- **Android Chrome**: "Add to Home Screen" prompt
- **iOS Safari**: Share → "Add to Home Screen"

## Development

```bash
# Run tests
python -m pytest pytodo/tests/ -v

# Run with debug mode
pytodo runserver --debug
```

## License

MIT
