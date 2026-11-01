# AI Role Interview Prep Chatbot

A Vite + React chatbot that helps you prepare for interviews for AI roles: AI Product Manager, Forward Deployed Engineer, AI Researcher, AI Architect and AI Engineer. It uses Google Gemini (default model `gemini-3.8-flash`, changeable in the sidebar).

## Features
- Pick the role you are interviewing for; each role has its own tailored coach, chat history and accent colours.
- Chat tab for mock interviews, concept reviews and feedback.
- Quiz tab with AI-generated multiple-choice questions and explanations.
- Automatic retries, plus a fallback to `gemini-2.5-flash` if the main model is busy.

## Run locally
```bash
npm install
npm run dev
```

Enter your Gemini API key on first load. It is kept in sessionStorage and sent only to Google.
