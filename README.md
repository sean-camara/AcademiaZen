<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AcademiaZen Frontend

> A modern Progressive Web App (PWA) for academic productivity, task management, focus sessions, and AI-powered study tools.

[![React](https://img.shields.io/badge/React-19.2.3-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.17-38B2AC.svg)](https://tailwindcss.com/)

## 🌟 Features

### Core Functionality
- **📋 Task Management** - Create, organize, and track academic tasks with due dates and subject categorization
- **⏱️ Focus Timer (Pomodoro)** - Customizable focus sessions with ambient soundscapes (rain, forest) and session reflection
- **📚 Digital Library** - Upload and manage PDFs with built-in reader, text extraction, and organization system
- **🧠 AI Study Assistant (ZenAI)** - Chat with an AI tutor powered by DeepSeek, reference your notes and PDFs
- **📝 AI Reviewer/Quiz Generator** - Generate custom quizzes from PDFs with multiple question types and timed tests
- **📅 Calendar View** - Visual timeline of upcoming tasks and deadlines
- **🎯 Focus Analytics** - Track session completion rates, streaks, and quit patterns
- **🔔 Push Notifications** - Web push for task reminders and focus session alerts

### Technical Features
- **Progressive Web App (PWA)** - Installable, offline-capable, works like a native app
- **Firebase Authentication** - Secure email/password and Google OAuth login
- **Real-time Sync** - State synchronized with backend MongoDB
- **Cloud PDF Storage** - PDFs stored in Cloudflare R2 with pre-signed URLs
- **Responsive Design** - Mobile-first UI that works on all devices
- **Dark Theme** - Custom "Zen" color palette optimized for focus

## 🏗️ Architecture

### Frontend Stack
```
React 19 + TypeScript
├── Vite (Build Tool & Dev Server)
├── TailwindCSS (Styling)
├── Firebase SDK (Auth)
├── Context API (State Management)
└── Service Worker (PWA + Push)
```

### Project Structure
```
AcademiaZen/
├── components/          # Reusable UI components
│   ├── AddTaskModal.tsx
│   ├── AddKnowledgeModal.tsx
│   ├── ConfirmModal.tsx
│   ├── ErrorBoundary.tsx
│   ├── Icons.tsx
│   └── Layout.tsx       # Main app navigation
├── context/            # React Context providers
│   ├── AuthContext.tsx # Firebase auth state
│   └── ZenContext.tsx  # App state + sync logic
├── pages/              # Main app screens
│   ├── Home.tsx        # Task management dashboard
│   ├── Focus.tsx       # Pomodoro timer with ambience
│   ├── Library.tsx     # PDF library + reader
│   ├── Review.tsx      # AI quiz generator
│   ├── ZenAI.tsx       # AI chat assistant
│   ├── Calendar.tsx    # Task calendar view
│   ├── Settings.tsx    # User preferences
│   └── Auth.tsx        # Login/signup
├── utils/              # Helper functions
│   ├── api.ts          # Backend API client
│   ├── helpers.ts      # Date formatting, ID generation
│   ├── pdfStorage.ts   # R2 upload/download
│   └── pushNotifications.ts
├── public/
│   ├── sw.js           # Service worker
│   ├── manifest.json   # PWA manifest
│   └── sounds/         # Notification + ambience audio
├── App.tsx             # Root component
├── types.ts            # TypeScript interfaces
└── constants.ts        # Default state + settings
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Firebase Project** (for authentication)
- **Backend API** running (see AcademiaZen_Backend)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AcademiaZen
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env.local
   ```

4. **Configure environment variables**
   
   Edit `.env.local` with your credentials:
   ```env
   # Backend API
   VITE_API_URL=http://localhost:3001

   # Firebase Web Configuration
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123

   # VAPID Public Key (from backend)
   VITE_VAPID_PUBLIC_KEY=your_vapid_public_key

   # Optional: PDF Upload Limits
   VITE_MAX_UPLOAD_BYTES=10485760  # 10 MB
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

   The app will open at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## 🔐 Authentication

AcademiaZen uses Firebase Authentication with email verification required.

### Sign Up Flow
1. User creates account with email/password or Google OAuth
2. Verification email sent (must verify before app access)
3. Backend creates MongoDB user document
4. State automatically synced to cloud

### Firebase Setup
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → **Email/Password** and **Google** providers
3. Add your domain to **Authorized domains**
4. Copy web config to `.env.local`

## 📱 Progressive Web App (PWA)

### Installation
- **Desktop**: Click install icon in address bar (Chrome/Edge)
- **Mobile**: "Add to Home Screen" from browser menu
- **iOS Safari**: Share → Add to Home Screen

### Service Worker Features
- **Offline Access** - App shell cached for offline use
- **Background Sync** - State syncs when connection restored
- **Push Notifications** - Receive task reminders even when app closed

### Manifest Configuration
Edit `public/manifest.json` to customize:
- App name and description
- Icons (72x72 to 512x512)
- Theme color
- Display mode (standalone/fullscreen)

## 🔔 Push Notifications

### How It Works
```
Frontend                    Backend                    Browser Push Service
   │                           │                              │
   │ 1. Register SW            │                              │
   │ 2. Get VAPID Key ─────────>│                              │
   │<───────────────────────────│                              │
   │ 3. Subscribe ──────────────────────────────────────────>│
   │<──────────────────────── subscription object ───────────│
   │ 4. Send subscription ──────>│                              │
   │                           │ 5. Store in MongoDB           │
   │                           │                              │
   │                           │ 6. Send notification ─────────>│
   │<────────────────────────── push event ───────────────────│
   │ 7. Service Worker          │                              │
   │    shows notification      │                              │
```

### Enable Notifications
1. Click Settings → Enable Notifications
2. Browser prompts for permission
3. Notifications sent for:
   - Tasks due within 3 days
   - Focus session completion
   - Custom reminders

## 🧪 State Management

### ZenContext
Global state managed by React Context API:

```typescript
interface ZenState {
  tasks: Task[];                    // User's task list
  subjects: Subject[];              // Course/subject categorization
  flashcards: Flashcard[];          // Spaced repetition cards
  folders: Folder[];                // Library organization
  aiReviewers: AIReviewer[];        // Generated quizzes
  profile: UserProfile;             // User info
  settings: AppSettings;            // Preferences
}
```

### Sync Strategy
- **Optimistic Updates** - UI updates immediately
- **Debounced Sync** - Changes batched and sent every 2 seconds
- **Conflict Resolution** - Last-write-wins (server authoritative)
- **Local Storage** - State persisted for instant load

## 🎨 Theming

### Custom Zen Color Palette
```css
--zen-bg: #0a0a0a           /* Deep black background */
--zen-card: #111111         /* Card surfaces */
--zen-surface: #1a1a1a      /* Interactive surfaces */
--zen-primary: #10b981      /* Emerald accent */
--zen-text-primary: #f3f4f6 /* High contrast text */
--zen-text-secondary: #9ca3af /* Muted text */
```

### TailwindCSS Configuration
Extend in `tailwind.config.cjs`:
```javascript
theme: {
  extend: {
    colors: {
      zen: {
        bg: '#0a0a0a',
        card: '#111111',
        // ... more colors
      }
    }
  }
}
```

## 📦 Docker Deployment

### Dockerfile
The frontend uses multi-stage builds:
1. **Build Stage** - Compiles React app with Vite
2. **Production Stage** - Serves static files with Nginx

```bash
docker build -t academiazen-frontend .
docker run -p 80:80 academiazen-frontend
```

### Environment Variables in Docker
Pass build-time variables:
```bash
docker build \
  --build-arg VITE_API_URL=https://api.yourdomain.com \
  --build-arg VITE_FIREBASE_API_KEY=your_key \
  -t academiazen-frontend .
```

### Docker Compose
See root `docker-compose.yml` for full stack deployment.

## 🛠️ Development

### Code Style
- **TypeScript** strict mode enabled
- **React Hooks** for all components (no class components)
- **Functional components** with proper typing
- **TailwindCSS** utility classes (avoid inline styles)

### Adding a New Page
1. Create component in `pages/YourPage.tsx`
2. Add route in `Layout.tsx` navigation
3. Define types in `types.ts` if needed
4. Update `ZenContext` for state management

### PDF.js Integration
```typescript
// Load PDF.js from CDN (in index.html)
<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"></script>

// Use in components
const pdfjsLib = (window as any).pdfjsLib;
const pdf = await pdfjsLib.getDocument(url).promise;
```

## 🐛 Troubleshooting

### Service Worker Not Updating
```javascript
// Force update in console
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});
location.reload();
```

### Firebase Auth Errors
- Check Firebase console for enabled providers
- Verify domain is in authorized domains list
- Ensure API keys are correct in `.env.local`

### Push Notifications Not Working
- HTTPS required (localhost is exempt)
- Check browser notification permissions
- Verify VAPID keys match backend
- Test with `/api/vapid-public-key` endpoint

### PDF Upload Fails
- Check file size < `VITE_MAX_UPLOAD_BYTES`
- Verify backend R2 configuration
- Check CORS settings on R2 bucket

## 📄 License

No license file is currently included. All rights are reserved unless a license is added later.

## 🤝 Contributing

This is an academic project. For questions or contributions, contact the maintainers.

## 📞 Support

For deployment issues, see:
- `/DEPLOYMENT_GUIDE.md` - Production deployment
- `/VPS_SETUP.md` - Server configuration
- Backend README for API documentation

## Project Screenshot

![AcademiaZen student dashboard](https://raw.githubusercontent.com/sean-camara/sean-camara-portfolio/main/public/assets/academiazen-screenshot.png)

## Testing Strategy

Vitest tests cover API helpers, constants, navigation, calendar and library behavior, empty states, and error boundaries. Playwright covers the public browser experience. Run `npm run typecheck`, `npm run test:run`, `npm run test:e2e`, and `npm run build`. `npm run test:coverage` can generate a report, but no coverage percentage is published. Authenticated cross-service workflows, offline recovery, and notification/provider paths need broader automated coverage.

## Known Limitations

- Some authenticated features require the separately deployed API and configured Firebase services.
- Offline behavior is intentionally limited for private or server-owned data.
- AI, billing, storage, and push behavior depend on external provider configuration.

## Future Improvements

- Expand authenticated browser tests and offline/reconnect scenarios.
- Add provider-contract tests using safe sandbox configuration.
- Keep bundle checks and accessibility coverage in the release gate.
