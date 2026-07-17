import os
import subprocess
import shlex
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Basic Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-key-change-me')
# Define where you want the downloaded files to be saved
DOWNLOAD_DIR = os.path.expanduser("~/Downloads") 

@app.route('/', methods=['GET'])
def index():
    """Renders the simple configuration web interface."""
    return render_template('index.html')

@app.route('/download', methods=['POST'])
def download_audio():
    raw_input = request.form.get('raw_input', '').strip()
    
    if not raw_input:
        return jsonify({"status": "error", "message": "No input provided"}), 400

    # Parse the pipe-separated string
    parts = [p.strip() for p in raw_input.split('|')]
    if len(parts) < 4:
        return jsonify({"status": "error", "message": "Invalid format"}), 400

    url = parts[0]
    artist = parts[1]
    album = parts[2]
    title = parts[3]
    cover_url = parts[4] if len(parts) > 4 else ""

    try:
        # Execute your bash script and pass the variables as arguments
        # This acts exactly like running: ./script.sh "url" "artist" "album" "title" "cover"
        result = subprocess.run(
            ['./bash-auto.sh', f"\"{raw_input}\""],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True  # Automatically decodes stdout/stderr to strings
        )

        return jsonify({
            "status": "success", 
            "message": f"Script output: {result.stdout.strip()}"
        })

    except subprocess.CalledProcessError as e:
        return jsonify({
            "status": "error", 
            "message": f"Script failed with exit code {e.returncode}: {e.stderr.strip()}"
        }), 500
        
    except Exception as e:
        print(e)
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # Run locally on localhost. Change host to '0.0.0.0' to access it across your LAN.
    app.run(host='127.0.0.1', port=5000, debug=True)