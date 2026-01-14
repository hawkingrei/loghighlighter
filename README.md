# LogHighlighter

A client-only log highlighting tool built with Next.js. Paste logs or load them from a URL, then apply customizable regex rules stored in localStorage.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Features

- Default regex rules baked into the code
- Custom rules persisted locally in the browser
- URL loading with CORS-friendly fetch
- Copy highlighted text or download raw logs

## Deployment (Vercel)

This app is static and requires no backend. Deploy on Vercel:

```bash
npm run build
```

Then import the repo in Vercel and deploy. The included `vercel.json` sets the framework to Next.js.
