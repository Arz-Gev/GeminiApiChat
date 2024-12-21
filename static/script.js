// Get references to HTML elements we'll need
const chatHistory = document.getElementById("chat-history");  // Chat messages container
const userInput = document.getElementById("user-input");      // Text input field
const sendButton = document.getElementById("send-button");    // Send message button
const clearButton = document.getElementById("clear-button");  // Clear history button
let eventSource = null;  // Will store EventSource connection

// Function to add a new message to the chat
function addMessageToChat(sender, message) {
    // Create new message element
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender === "Вы" ? "user-message" : "gemini-message");
    
    // Prevent XSS attacks by escaping HTML characters
    const sanitizedMessage = `${sender}: ${message}`.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    messageDiv.innerHTML = sanitizedMessage;
    
    // Add message to chat and scroll to bottom
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Function to clear all messages from chat
function clearChatHistory() {
    while (chatHistory.firstChild) {
        chatHistory.removeChild(chatHistory.firstChild);
    }
}

// Function to handle different types of responses
function handleResponse(response) {
    if (response.startsWith('user_message:')) {
        // Handle user message
        const userMessage = response.substring('user_message:'.length);
        addMessageToChat("Вы", userMessage);
    } else if (response === 'typing') {
        // Show typing indicator
        addMessageToChat("Gemini", "печатает...");
    } else if (response.startsWith('Error:')) {
        // Handle error response
        const typingMessage = chatHistory.querySelector('.gemini-message:last-child');
        if (typingMessage && typingMessage.textContent === "Gemini: печатает...") {
            typingMessage.remove();
        }
        addMessageToChat("Gemini", "Произошла ошибка. Пожалуйста, попробуйте позже.");
    } else {
        // Handle normal response
        const typingMessage = chatHistory.querySelector('.gemini-message:last-child');
        if (typingMessage && typingMessage.textContent === "Gemini: печатает...") {
            typingMessage.remove();
        }
        addMessageToChat("Gemini", response);
    }
}

// Function to send a message to the server
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;  // Don't send empty messages

    try {
        // Add user message to chat
        addMessageToChat("Вы", message);
        
        // Clear input and disable controls
        userInput.value = "";
        userInput.disabled = true;
        sendButton.disabled = true;

        // Show typing indicator
        addMessageToChat("Gemini", "печатает...");

        // Send message to server
        const response = await fetch('/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ message: message })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        
        // Remove typing indicator
        const typingMessage = chatHistory.querySelector('.gemini-message:last-child');
        if (typingMessage && typingMessage.textContent === "Gemini: печатает...") {
            typingMessage.remove();
        }

        // Show response or error
        if (data.response) {
            addMessageToChat("Gemini", data.response);
        } else if (data.error) {
            addMessageToChat("Gemini", "Произошла ошибка. Пожалуйста, попробуйте позже.");
        }

    } catch (error) {
        // Handle any errors
        console.error("Failed to send message:", error);
        const typingMessage = chatHistory.querySelector('.gemini-message:last-child');
        if (typingMessage && typingMessage.textContent === "Gemini: печатает...") {
            typingMessage.remove();
        }
        addMessageToChat("Gemini", "Произошла ошибка. Пожалуйста, попробуйте позже.");
    } finally {
        // Re-enable controls
        userInput.disabled = false;
        sendButton.disabled = false;
    }
}

// Add click handler for send button
sendButton.addEventListener("click", sendMessage);

// Add click handler for clear history button
clearButton.addEventListener("click", async () => {
    try {
        const response = await fetch("/clear_history", { 
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        if (data.message === "Chat history cleared") {
            clearChatHistory();
        }
    } catch (error) {
        console.error("Failed to clear history:", error);
    }
});

// Add handler for Enter key
userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !eventSource) {
        event.preventDefault();
        sendMessage();
    }
});

// Clean up when page is closed
window.addEventListener('beforeunload', () => {
    if (eventSource) {
        eventSource.close();
    }
});