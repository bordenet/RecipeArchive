#!/usr/bin/env python3
"""
Simple mock backend server for testing RecipeArchive extensions
Handles POST requests to /api/recipes endpoint
"""

import json
import http.server
import socketserver
from urllib.parse import urlparse, parse_qs
from datetime import datetime

class RecipeArchiveHandler(http.server.SimpleHTTPRequestHandler):
    
    def end_headers(self):
        # Add CORS headers for extension compatibility
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.end_headers()
    
    def do_POST(self):
        # Handle recipe submission
        if self.path == '/api/recipes':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                recipe_data = json.loads(post_data.decode('utf-8'))
                
                print(f"📥 Received recipe: {recipe_data.get('title', 'Unknown')}")
                print(f"   URL: {recipe_data.get('url', 'N/A')}")
                print(f"   Ingredients: {len(recipe_data.get('ingredients', []))}")
                print(f"   Steps: {len(recipe_data.get('steps', []))}")
                
                # Mock successful response
                response = {
                    "success": True,
                    "id": f"recipe_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    "message": "Recipe saved successfully",
                    "timestamp": datetime.now().isoformat()
                }
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
            except Exception as e:
                print(f"❌ Error processing recipe: {e}")
                error_response = {
                    "success": False,
                    "error": str(e),
                    "message": "Failed to process recipe"
                }
                
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
        else:
            # For non-recipe endpoints, use default behavior
            super().do_POST()
    
    def do_GET(self):
        # Handle API status check
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/status':
            response = {
                "status": "ok",
                "service": "RecipeArchive Mock Backend",
                "timestamp": datetime.now().isoformat()
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            # For static files, use default behavior
            super().do_GET()

if __name__ == "__main__":
    PORT = 8082
    
    print(f"""
🍳 RecipeArchive Mock Backend Server
📡 Starting server on http://localhost:{PORT}

📋 Available endpoints:
   GET  /api/status    - Service status
   POST /api/recipes   - Submit captured recipes
   GET  /*            - Static file serving

🧪 Ready for extension testing!
""")
    
    with socketserver.TCPServer(("", PORT), RecipeArchiveHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")
