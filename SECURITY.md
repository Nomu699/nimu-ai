# Nimu AI security notes

## Required environment variables

Keep these values server-side in Netlify environment variables:

- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `OPENAI_MODEL` (optional)

Never put `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in browser JavaScript,
HTML, GitHub source, or `config.js`.

## Authentication

The `/chat` and `/history` functions require:

```text
Authorization: Bearer <Supabase access token>
```

The server verifies the token with Supabase and derives `user.id` from the
verified session. A client-supplied `user_id` must not be trusted.

## Rate limiting

This version validates authentication and bounds request size, but it does not
provide distributed rate limiting by itself.

For production, add Netlify Edge/Function rate limiting or an external rate
limiter keyed by authenticated user ID/IP. Recommended starting limits:

- authenticated: 30 chat requests / minute
- guest: disabled until a server-side quota is implemented
- maximum message size: 4,000 characters

Do not implement rate limits only in `app.js`; attackers can call the function
directly.

## Data retention

Add a product-level retention policy for old conversations and provide a
delete-history control. Consider scheduled deletion after a defined period.

## Deployment checklist

1. Set secrets in Netlify environment variables.
2. Do not commit `.env` files.
3. Rotate any key that was ever committed publicly.
4. Run the Supabase SQL migration.
5. Confirm unauthenticated requests to `/chat` return HTTP 401.
6. Confirm one user's history cannot be queried using another user's ID.
7. Add automated tests for auth failures, oversized messages, malformed JSON,
   and cross-user access.
