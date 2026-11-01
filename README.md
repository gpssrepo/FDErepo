# AI Interview Agent

Vite + React chatbot that coaches you for AI roles (AI PM, Forward Deployed Engineer, AI Researcher, AI Architect, AI Engineer) using Gemini (`gemini-3.8-flash`, set in `src/gemini.js`).

```bash
npm install
npm run dev
```

Enter your Gemini API key on first load (kept in sessionStorage, sent only to Google). Each role has its own system prompt, chat history and accent colors.
