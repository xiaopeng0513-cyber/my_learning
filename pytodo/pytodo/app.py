"""Flask application factory for PyTodo."""

import os

from flask import Flask, render_template

from pytodo.config import DevelopmentConfig, ProductionConfig
from pytodo.db import init_app as db_init_app
from pytodo.db import init_db


def create_app(config=None):
    """Create and configure the Flask application."""
    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="static",
        static_url_path="/static",
    )

    # Configuration
    if config is None:
        env = os.environ.get("PYTODO_ENV", "development")
        config = ProductionConfig() if env == "production" else DevelopmentConfig()

    if isinstance(config, dict):
        app.config.update(config)
    else:
        app.config.from_object(config)

    # Initialize database
    with app.app_context():
        init_db(app)
    db_init_app(app)

    # Register blueprints
    from pytodo.auth.views import auth_bp
    from pytodo.share.views import register_share_redirect, share_bp
    from pytodo.tasks.views import tasks_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(tasks_bp, url_prefix="/api/tasks")
    app.register_blueprint(share_bp, url_prefix="/api/share")
    register_share_redirect(app)

    # Main SPA route
    @app.route("/")
    def index():
        return render_template("index.html")

    return app
