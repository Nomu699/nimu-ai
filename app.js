const cfg = window.NIMU_CONFIG;

const configured =
  cfg &&
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  !cfg.SUPABASE_URL.includes("YOUR_") &&
  !cfg.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");

const supabase = configured
  ? window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY
    )
  : null;

const $ = (id) => document.getElementById(id);

const chat = $("chat");
const input = $("input");
const form = $("chatForm");

let history = [];
let signup = false;

function add(role, text) {
  const row = document.createElement("div");
  row.className = "row " + role;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  row.appendChild(bubble);

  if (role === "ai") {
    const tools = document.createElement("div");
    tools.className = "tools";

    const button = document.createElement("button");
    button.textContent = "🔊";
    button.title = "Read aloud";
    button.onclick = () => speak(text);

    tools.appendChild(button);
    row.appendChild(tools);
  }

  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function typing() {
  const row = document.createElement("div");
  row.className = "row ai";
  row.id = "typing";

  row.innerHTML =
    '<div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div>';

  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.96;
  utterance.pitch = 1.06;

  speechSynthesis.speak(utterance);
}

async function getSession() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error(error);
    return null;
  }

  return data.session;
}

async function refresh() {
  const session = await getSession();

  if (session) {
    $("auth").style.display = "none";
    $("userBadge").textContent = session.user.email;

    $("memoryStatus").textContent =
      "Memory is on. Your conversations can follow you across sessions.";

    $("logout").style.display = "block";

    await loadHistory();
  } else {
    $("auth").style.display = "grid";
    $("userBadge").textContent = "Guest";
    $("logout").style.display = "none";
  }
}

async function loadHistory() {
  const session = await getSession();

  if (!session) return;

  try {
    const response = await fetch("/.netlify/functions/history", {
      headers: {
        Authorization: "Bearer " + session.access_token
      }
    });

    const data = await response.json();

    if (data.messages && data.messages.length) {
      document.querySelector(".hero")?.remove();

      data.messages.forEach((message) => {
        const role = message.role === "assistant" ? "ai" : "user";

        add(role, message.content);

        history.push({
          role: message.role,
          content: message.content
        });
      });
    }
  } catch (error) {
    console.warn("History error:", error);
  }
}

$("loginTab").onclick = () => {
  signup = false;

  $("loginTab").classList.add("active");
  $("signupTab").classList.remove("active");

  $("authSubmit").textContent = "Log in";
};

$("signupTab").onclick = () => {
  signup = true;

  $("signupTab").classList.add("active");
  $("loginTab").classList.remove("active");

  $("authSubmit").textContent = "Create account";
};

$("authForm").onsubmit = async (event) => {
  event.preventDefault();

  $("authMsg").textContent = "";

  if (!supabase) {
    $("authMsg").textContent =
      "Supabase is not configured yet.";

    return;
  }

  const email = $("email").value.trim();
  const password = $("password").value;

  let result;

  if (signup) {
    result = await supabase.auth.signUp({
      email,
      password
    });
  } else {
    result = await supabase.auth.signInWithPassword({
      email,
      password
    });
  }

  if (result.error) {
    $("authMsg").textContent = result.error.message;
    return;
  }

  if (signup && !result.data.session) {
    $("authMsg").textContent =
      "Check your email to confirm your account.";
  } else {
    await refresh();
  }
};

$("demoBtn").onclick = () => {
  $("auth").style.display = "none";

  $("memoryStatus").textContent =
    "Guest mode: memory stays only in this browser session.";
};

$("logout").onclick = async () => {
  if (supabase) {
    await supabase.auth.signOut();
  }

  location.reload();
};

document.querySelectorAll(".chips button").forEach((button) => {
  button.onclick = () => {
    input.value = button.textContent
      .replace(/[✨💗😂]/g, "")
      .trim();

    input.focus();
  };
});

form.onsubmit = async (event) => {
  event.preventDefault();

  const text = input.value.trim();

  if (!text) return;

  document.querySelector(".hero")?.remove();

  add("user", text);

  history.push({
    role: "user",
    content: text
  });

  input.value = "";

  $("send").disabled = true;

  typing();

  try {
    const headers = {
      "Content-Type": "application/json"
    };

    const session = await getSession();

    if (session) {
      headers.Authorization =
        "Bearer " + session.access_token;
    }

    const response = await fetch(
      "/.netlify/functions/chat",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: history.slice(-24),
          guest: !session
        })
      }
    );

    const data = await response.json();

    $("typing")?.remove();

    if (!response.ok) {
      throw new Error(
        data.error || "Request failed"
      );
    }

    add("ai", data.reply);

    history.push({
      role: "assistant",
      content: data.reply
    });

  } catch (error) {
    $("typing")?.remove();

    add(
      "ai",
      "Connection error. Please try again."
    );

    console.error("Chat error:", error);

  } finally {
    $("send").disabled = false;
    input.focus();
  }
};

$("mic").onclick = () => {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "Voice input is not supported in this browser."
    );

    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "bn-BD";
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    input.value =
      event.results[0][0].transcript;

    input.focus();
  };

  recognition.start();
};

if (supabase) {
  supabase.auth.onAuthStateChange(() => {
    refresh();
  });
}

refresh();
