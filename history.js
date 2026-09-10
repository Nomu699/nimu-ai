// Netlify Function: /.netlify/functions/history
// Returns history only for the authenticated Supabase user.

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const token = getBearerToken(event);
  if (!token) {
    return json(401, { error: "Authentication required" });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return json(401, { error: "Invalid or expired session" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("messages")
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("History query failed:", error);
      return json(500, { error: "Unable to load history" });
    }

    return json(200, { messages: data || [] });
  } catch (error) {
    console.error("History function error:", error);
    return json(500, { error: "Unable to load history" });
  }
};
