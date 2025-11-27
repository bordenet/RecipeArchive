#!/usr/bin/env python3
"""Mock backend server for testing RecipeArchive browser extensions.

This module provides a simple HTTP server that simulates the RecipeArchive
backend API for extension development and testing purposes.

Example:
    Run the server:
        $ python mock-backend-server.py

    The server will start on http://localhost:8081 with the following endpoints:
        - GET /api/status - Returns server status
        - POST /api/recipes - Accepts recipe submissions
        - GET /* - Serves static files
"""

from __future__ import annotations

import http.server
import json
import socketserver
from datetime import datetime
from typing import Any
from urllib.parse import urlparse


class RecipeArchiveHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler for the RecipeArchive mock backend.

    Extends SimpleHTTPRequestHandler to add CORS support and custom
    endpoints for recipe submission and status checks.
    """

    def end_headers(self) -> None:
        """Add CORS headers to all responses for extension compatibility."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.end_headers()

    def do_POST(self) -> None:
        """Handle POST requests for recipe submission.

        Accepts JSON recipe data at /api/recipes and returns a mock
        success response with a generated recipe ID.
        """
        if self.path == "/api/recipes":
            self._handle_recipe_submission()
        else:
            super().do_POST()

    def do_GET(self) -> None:
        """Handle GET requests for status checks and static files.

        Returns server status at /api/status, otherwise serves static files.
        """
        parsed_path = urlparse(self.path)
        if parsed_path.path == "/api/status":
            self._handle_status_request()
        else:
            super().do_GET()

    def _handle_recipe_submission(self) -> None:
        """Process a recipe submission request.

        Reads JSON recipe data from the request body, logs the submission,
        and returns a mock success response.
        """
        try:
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length)
            recipe_data: dict[str, Any] = json.loads(post_data.decode("utf-8"))

            print(f"📥 Received recipe: {recipe_data.get('title', 'Unknown')}")
            print(f"   URL: {recipe_data.get('url', 'N/A')}")
            print(f"   Ingredients: {len(recipe_data.get('ingredients', []))}")
            print(f"   Steps: {len(recipe_data.get('steps', []))}")

            response: dict[str, Any] = {
                "success": True,
                "id": f"recipe_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "message": "Recipe saved successfully",
                "timestamp": datetime.now().isoformat(),
            }

            self._send_json_response(200, response)

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"❌ Error processing recipe: {e}")
            error_response: dict[str, Any] = {
                "success": False,
                "error": str(e),
                "message": "Failed to process recipe",
            }
            self._send_json_response(400, error_response)

    def _handle_status_request(self) -> None:
        """Return server status as JSON."""
        response: dict[str, Any] = {
            "status": "ok",
            "service": "RecipeArchive Mock Backend",
            "timestamp": datetime.now().isoformat(),
        }
        self._send_json_response(200, response)

    def _send_json_response(self, status_code: int, data: dict[str, Any]) -> None:
        """Send a JSON response with the given status code and data.

        Args:
            status_code: HTTP status code to return.
            data: Dictionary to serialize as JSON response body.
        """
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))


def main() -> None:
    """Start the mock backend server."""
    port = 8081

    print(f"""
🍳 RecipeArchive Mock Backend Server
📡 Starting server on http://localhost:{port}

📋 Available endpoints:
   GET  /api/status    - Service status
   POST /api/recipes   - Submit captured recipes
   GET  /*            - Static file serving

🧪 Ready for extension testing!
""")

    with socketserver.TCPServer(("", port), RecipeArchiveHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")


if __name__ == "__main__":
    main()
