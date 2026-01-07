# AutoReadme

> **Change-aware code documentation engine** — A VS Code extension that automatically generates meaningful comments for newly written or edited code and keeps project documentation up-to-date.

## 🎯 What This Does

- **Detects meaningful code changes** on file save
- **Generates intent-focused comments** for new/modified logic
- **Never comments obvious code** or overwrites existing comments
- **Previews suggestions** — you always have control (Accept / Edit / Reject)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys

# Extension
cd ../extension
npm install
```

### 2. Configure API Keys

Edit `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

### 3. Run Development

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Open extension in VS Code
cd extension
code .
# Press F5 to launch Extension Development Host
```

## 📁 Project Structure

```
AutoReadme/
├── extension/          # VS Code Extension
│   ├── src/
│   │   ├── extension.ts         # Entry point
│   │   ├── diffDetector.ts      # Change detection
│   │   ├── decorationProvider.ts # UI prompts
│   │   ├── previewPanel.ts      # Preview webview
│   │   └── apiClient.ts         # Backend client
│   └── package.json
│
├── backend/            # Cloud Service
│   ├── src/
│   │   ├── index.ts             # Express server
│   │   ├── routes/              # API endpoints
│   │   └── services/            # Core logic
│   └── package.json
│
└── shared/             # Shared types
    └── types.ts
```

## 🎨 Features

### Comment Styles

- **Short** — One-line, concise comments
- **Explanatory** — 2-3 sentences explaining intent
- **PR-Review** — What changed and why

### Smart Filtering

The tool **never comments**:
- Obvious syntax (loops, if statements)
- Import statements
- Whitespace changes
- Console logs / debug code
- Self-explanatory variable declarations

## 🔧 Configuration

Extension settings (`File > Preferences > Settings > AutoReadme`):

| Setting | Default | Description |
|---------|---------|-------------|
| `autoreadme.commentStyle` | `explanatory` | Default comment style |
| `autoreadme.autoPrompt` | `true` | Show prompts on save |
| `autoreadme.minChangeLines` | `3` | Minimum lines to trigger |

## 📝 License

MIT
