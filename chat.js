// Netlify Function: /.netlify/functions/chat
// Security-focused version: validates auth, limits input, and keeps secrets server-side.

const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 40;
const DEFAULT_MODEL = "gpt-4o-mini";

// Whitelist models you intentionally allow in production.
const ALLOWED_MODELS = new Set([
  process.env.OPENAI_MODEL || DEFAULT_MODEL,
]);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
    body: JSON.stringify(body),
  };
}

function getBearerToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

function getClientIp(event) {
  return (
    event.headers?.["x-nf-client-connection-ip"] ||
    event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    "unknown"
  );
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return json(400, { error: "Message is required" });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return json(413, {
      error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
    });
  }

  // Require a Supabase access token. Do not trust a user ID supplied by the client.
  const token = getBearerToken(event);
  if (!token) {
    return json(401, { error: "Authentication required" });
  }

  const { data: { user }, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return json(401, { error: "Invalid or expired session" });
  }

  // Only accept a bounded history from the client.
  const incomingHistory = Array.isArray(body.history)
    ? body.history.slice(-MAX_HISTORY_MESSAGES)
    : [];

  const history = incomingHistory
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    )
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, MAX_MESSAGE_LENGTH),
    }));

  const model = ALLOWED_MODELS.has(process.env.OPENAI_MODEL)
    ? process.env.OPENAI_MODEL
    : DEFAULT_MODEL;

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are Nimu, a helpful AI companion. Be warm and respectful. " +
            "Do not encourage emotional dependency, exclusivity, or isolation.",
        },
        ...history,
        { role: "user", content: message },
      ],
      max_tokens: 1000,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return json(502, { error: "The AI returned an empty response" });
    }

    // Store only server-derived user identity.
    const { error: insertError } = await supabaseAdmin
      .from("messages")
      .insert({
        user_id: user.id,
        role: "user",
        content: message,
      });

    if (insertError) {
      console.error("Failed to store user message:", insertError);
    }

    const { error: replyInsertError } = await supabaseAdmin
      .from("messages")
      .insert({
        user_id: user.id,
        role: "assistant",
        content: reply,
      });

    if (replyInsertError) {
      console.error("Failed to store assistant message:", replyInsertError);
    }

    return json(200, {
      reply,
      userId: user.id,
    });
  } catch (error) {
    console.error("Chat function error:", {
      message: error?.message,
      ip: getClientIp(event),
      userId: user.id,
    });

    return json(500, { error: "Unable to process request" });
  }
};
