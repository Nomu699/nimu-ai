# nimu.ai Premium

Includes:
- Premium responsive UI
- Real OpenAI Responses API
- Email/password login via Supabase
- Long-term conversation memory stored in Supabase
- Voice input via browser Speech Recognition
- Voice output via browser Speech Synthesis
- Guest mode

## 1) Supabase
Create a project, enable Email/Password Auth, run `supabase.sql` in SQL Editor.
Put your project URL and publishable key in `config.js`.

Supabase supports `signUp()` and `signInWithPassword()` for email/password authentication.

## 2) Netlify environment variables
Set:
- OPENAI_API_KEY = your OpenAI API key
- OPENAI_MODEL = gpt-5.6-luna
- SUPABASE_URL = your Supabase project URL
- SUPABASE_PUBLISHABLE_KEY = your Supabase publishable key
- SUPABASE_SERVICE_ROLE_KEY = your Supabase service-role key (server only; never put this in config.js)

## 3) Deploy
Push the folder to GitHub and import it into Netlify.

The OpenAI key and Supabase service-role key are only used in Netlify Functions.
