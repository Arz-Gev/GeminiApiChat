# Import required libraries
from dotenv import load_dotenv  # Helps load environment variables from .env file
load_dotenv()  # Load variables from .env file into environment

# Import necessary Flask components and other libraries
from flask import Flask, render_template, request, jsonify, session, Response  # Flask web framework components
from datetime import timedelta  # For setting session lifetime
import google.generativeai as genai  # Google's Gemini AI API
import markdown  # For converting markdown to HTML
import traceback  # For detailed error tracking
import os  # For accessing environment variables
from functools import wraps  # For creating decorators

# Get the API key from environment variables
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')  # Read API key from environment
if not GOOGLE_API_KEY:
    raise ValueError("Please set the GOOGLE_API_KEY environment variable")

# Set up the Gemini AI model
genai.configure(api_key=GOOGLE_API_KEY)  # Configure Gemini with our API key
model = genai.GenerativeModel('gemini-pro')  # Create an instance of the Gemini model

# Initialize Flask application
app = Flask(__name__)  # Create Flask app
app.secret_key = os.getenv('FLASK_SECRET_KEY', os.urandom(24))  # Set secret key for session management
app.permanent_session_lifetime = timedelta(minutes=30)  # Set how long sessions last

# Decorator to ensure chat history exists in session
def check_session(f):
    @wraps(f)  # Preserve function metadata
    def decorated_function(*args, **kwargs):
        if 'chat_history' not in session:  # If no chat history exists
            session['chat_history'] = []    # Create empty chat history
        return f(*args, **kwargs)
    return decorated_function

# Route for the main page
@app.route("/")
@check_session  # Make sure we have a chat history
def index():
    return render_template("index.html")  # Show the main chat page

# Route for sending/receiving messages
@app.route("/send_message", methods=["POST", "GET"])
@check_session
def send_message():
    if request.method == "GET":
        # Handle Server-Sent Events (SSE) connection
        def generate():
            try:
                yield "data: connected\n\n".encode('utf-8')
            except Exception as e:
                app.logger.error(f"SSE Error: {str(e)}")
        return Response(generate(), mimetype='text/event-stream')
    
    # Handle POST request (when user sends a message)
    try:
        user_input = request.form.get("message", "").strip()  # Get and clean user message
        
        if not user_input:  # If message is empty
            return jsonify({"error": "Empty message"}), 400

        # Get response from Gemini AI
        chat = model.start_chat(history=session['chat_history'])
        response = chat.send_message(user_input)
        
        # Save messages to session history
        session['chat_history'].append({'role': 'user', 'parts': [user_input]})
        session['chat_history'].append({'role': 'model', 'parts': [response.text]})
        session.modified = True  # Mark session as modified
        
        return jsonify({"response": response.text})  # Return AI response

    except Exception as e:
        # Log any errors and return error message
        app.logger.error(f"Request handling error: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

# Route for clearing chat history
@app.route("/clear_history", methods=["POST"])
def clear_history():
    session['chat_history'] = []  # Clear the chat history
    session.modified = True       # Mark session as modified
    return jsonify({"message": "Chat history cleared"})

# Run the application
if __name__ == "__main__":
    app.run(debug=False)  # Start Flask server (debug mode off for production)