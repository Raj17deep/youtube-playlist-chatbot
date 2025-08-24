# 🎬 YouTube Playlist Chat Tool

An interactive **Next.js web app** that lets you analyze and chat with your **YouTube playlists** using **AI (Gemini or OpenAI GPT)**.
Simply enter a playlist URL, fetch details via the **YouTube Data API**, and ask AI-powered questions like:

* *“Which videos have the most views?”*
* *“What’s the total watch time of this playlist?”*
* *“Show me recent uploads about a topic.”*

---

## 🚀 Features

✅ **YouTube Playlist Analysis** – Fetches video titles, descriptions, channels, publish dates, views, likes, comments, and durations.
✅ **AI Chat** – Ask questions about playlist content using Google **Gemini** or **OpenAI GPT**.
✅ **Interactive UI** – Split view: playlist details on the left, AI chat on the right.
✅ **Backend Proxy** – Next.js API route (`/api/youtube-proxy`) to bypass **CORS** restrictions.
✅ **Dynamic Environment Detection** – Works in **local dev**, **Vercel deployment**, or **direct mode**.
✅ **Customizable Settings** – Enter API keys, switch AI providers, and manage backend connection mode.

---

## 🛠️ Tech Stack

* **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
* **Frontend**: React 19, TailwindCSS 4, Lucide Icons
* **Backend Proxy**: Next.js API route (`app/api/youtube-proxy/route.js`)
* **AI Integration**:

  * Google **Gemini API**
  * OpenAI **GPT API**
* **Languages**: TypeScript + JavaScript

---

## 📂 Project Structure

```
raj17deep-youtube-playlist-chatbot/
├── app/                      # Next.js App Router
│   ├── globals.css           # Global styles (Tailwind)
│   ├── layout.tsx            # Root layout
│   ├── page.js               # Homepage entry
│   ├── index.js              # Alternate entry point
│   └── api/
│       └── youtube-proxy/    # Backend proxy to YouTube API
│           └── route.js
├── components/
│   └── YouTubePlaylistChatTool.jsx  # Main app component
├── package.json              # Dependencies & scripts
├── eslint.config.mjs         # Linting config
├── postcss.config.mjs        # PostCSS config
├── tsconfig.json             # TypeScript config
├── next.config.ts            # Next.js config
└── README.md                 # Documentation
```

---

## ⚡ Getting Started

### 1️⃣ Clone the repo

```bash
git clone https://github.com/your-username/raj17deep-youtube-playlist-chatbot.git
cd raj17deep-youtube-playlist-chatbot
```

### 2️⃣ Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3️⃣ Run the dev server

```bash
npm run dev
```

Now open [http://localhost:3000](http://localhost:3000) 🚀

---

## 🔑 Setup API Keys

The app requires **two API keys**:

1. **YouTube Data API v3 Key**

   * Get it from [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   * Needed to fetch playlist/video data.

2. **AI Provider API Key** (Choose one):

   * **Google Gemini API** → [Get key](https://aistudio.google.com/app/apikey)
   * **OpenAI API** → [Get key](https://platform.openai.com/account/api-keys)

➡️ Enter both keys in the **Settings panel** inside the app.

---

## ⚙️ Deployment

### **Local Backend Mode (recommended)**

Next.js API proxy (`/api/youtube-proxy`) handles CORS automatically.

### **Deploy to Vercel**

Push your repo to GitHub and [import to Vercel](https://vercel.com/new).
Vercel automatically detects Next.js and deploys serverless functions.

### **Direct Mode (not recommended)**

If no backend is detected, the app tries to call YouTube APIs directly.
⚠️ This usually fails due to **CORS restrictions** unless you use a browser extension.

---

## 📸 UI Preview

* **Left Panel** – Playlist videos (thumbnail, title, channel, views, duration, date).
* **Right Panel** – Chat window with AI assistant.
* **Settings Panel** – API key management & provider selection.

---

## 🧪 Example Use Cases

* Summarize playlist topics
* Find the **most popular video**
* Calculate **total playlist watch time**
* Identify videos from a **specific channel**
* Explore **recently added videos**

---

## 📜 License

MIT License – free to use and modify.
