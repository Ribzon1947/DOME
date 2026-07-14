from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    return "Hello from DOME! Your Render deployment is working 🎉"

if __name__ == "__main__":
    # Render expects the app to listen on 0.0.0.0 and the PORT environment variable
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
