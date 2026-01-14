#!/bin/bash
# Simple local server launcher for Cowork

echo "🚀 Starting local server for Cowork..."
echo "📂 Serving from: $(pwd)"
echo ""

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "✅ Using Python 3"
    echo "🌐 Open in browser: http://localhost:8000/cowork.html"
    echo "🌐 Or for Sonar: http://localhost:8000/index.html"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "✅ Using Python 2"
    echo "🌐 Open in browser: http://localhost:8000/cowork.html"
    echo "🌐 Or for Sonar: http://localhost:8000/index.html"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    python -m SimpleHTTPServer 8000
else
    echo "❌ Python not found. Please install Python or use Option 2 below."
    exit 1
fi
