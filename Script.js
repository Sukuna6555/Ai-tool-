const sendBtn = document.getElementById("sendBtn");
const userInput = document.getElementById("userInput");
const chatBox = document.getElementById("chatBox");

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = userInput.value.trim();
  if (text === "") return;

  appendMessage("user", text);
  userInput.value = "";

  // Fake AI response for now
  setTimeout(() => {
    appendMessage("bot", generateAIResponse(text));
  }, 800);
}

function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.innerHTML = `<p>${text}</p>`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function generateAIResponse(input) {
  const replies = [
    "Interesting thought 🤔",
    "Tell me more about that!",
    "Wow, that’s deep 💭",
    "I’m here to listen 💬",
    "That sounds amazing!",
    "You’ve got a brilliant mind ✨",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}
