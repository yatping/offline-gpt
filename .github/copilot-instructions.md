# OfflineGPT Development Guide

## Project Overview

OfflineGPT is a React Native/Expo mobile app that provides **fully offline AI translation and chat** using on-device models. Translation uses ML Kit via `fast-mlkit-translate-text`; chat uses [llama.rn](https://github.com/mybigday/llama.rn) to run a quantized GGUF vision-language model directly on iOS/Android.

**Key capabilities:**
- Text, image (OCR), and voice translation between 35+ languages
- Real-time bidirectional conversation translation
- Offline chat AI with vision support (image understanding)
- In-app purchases for premium language packs

## Build, Test & Lint Commands

```bash
# Start development server
npm start
# or: npx expo start

# Run on specific platforms
npm run ios          # iOS simulator
npm run android      # Android emulator
npm run web          # Web browser

# Linting
npm run lint         # Run ESLint via Expo

# Build production
npx eas build --platform ios
npx eas build --platform android
```

**Note:** There are no automated tests currently configured in this project.

## Architecture Overview

### File-Based Routing (Expo Router v6)

The app uses [Expo Router](https://docs.expo.dev/router/introduction/) with file-based routing:

- `app/_layout.tsx` - Root layout with context providers
- `app/index.tsx` - Entry point (redirects to translate screen)
- `app/(tabs)/_layout.tsx` - Tab bar with 3 tabs: Menu, Translate, Chat
- `app/(tabs)/menu.tsx` - Menu/settings screen
- `app/(tabs)/translate.tsx` - Translation screen with text, camera OCR, and conversation modes
- `app/(tabs)/chat.tsx` - Chat AI screen with session management
- `app/modal.tsx` - Example modal screen

**Typed routes enabled** via `experiments.typedRoutes: true` in app.json.

### Context Architecture

The app uses React Context for global state management:

1. **DownloadManagerContext** (`contexts/download-manager-context.tsx`)
   - Manages downloading of the chat AI model (two files: model + mmproj) from HuggingFace
   - Tracks download progress and cancellation; shows a download prompt on first launch
   - Models stored in `Paths.document` (expo-file-system)
   - `ModelType = 'chat'` (only one type; translation uses ML Kit, no download required)

2. **ChatAIContext** (`contexts/chat-ai-context.tsx`)
   - Provides global access to the LFM2.5-VL vision-language model
   - Exposes `initializeModel`, `generateResponse`, `generateResponseWithImage`
   - Status lifecycle: `idle → loading → ready → generating`
   - Auto-initializes when `chatModel.status === 'completed'`

3. **TranslationContext** (`contexts/translation-context.tsx`)
   - Wraps `useTranslation` hook (ML Kit based) and provides global access
   - Manages 4 language preferences: source/target (text mode) and my/opponent (conversation mode)
   - Persists language selections to AsyncStorage
   - Keeps source↔my and target↔opponent languages in sync bidirectionally

**Context provider hierarchy** (defined in `app/_layout.tsx`):
```
ThemeProvider
└─ DownloadManagerProvider
   └─ ChatAIProvider
      └─ TranslationProvider
         └─ App content
```

### AI Model System

The app uses two separate on-device AI systems:

1. **Translation:** ML Kit via `fast-mlkit-translate-text`
   - Hook: `hooks/use-translation.ts`
   - No GGUF model file; language models download automatically per language pair
   - API: `FastTranslator.prepare({ source, target, downloadIfNeeded })` then `FastTranslator.translate(text)`
   - Caches the last prepared language pair to avoid redundant `prepare()` calls
   - No manual initialization or model lifecycle management required

2. **Chat AI Model:** `LFM2.5-VL-1.6B-Q8_0.gguf` + `mmproj-LFM2.5-VL-1.6b-Q8_0.gguf`
   - Hook: `hooks/use-chat-ai.ts` (local use) / Context: `contexts/chat-ai-context.tsx` (global)
   - Model: LiquidAI LFM2.5-VL 1.6B (vision-language, 8-bit quantized)
   - Downloaded from HuggingFace: `https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B-GGUF`
   - Requires **two files**: main model (~1.6GB) + mmproj (~0.3GB); progress split 0–80% / 80–100%
   - Prompt format: LFM2.5 ChatML
     ```typescript
     `<|startoftext|><|im_start|>system\n${systemMessage}<|im_end|>\n<|im_start|>user\n${userMessage}<|im_end|>\n<|im_start|>assistant\n`
     ```
   - Stop tokens: `['<|im_end|>', '<|endoftext|>']`
   - Vision: `llamaCtx.initMultimodal({ path: mmprojFile.uri, use_gpu: Platform.OS === 'ios' })` then pass `image_url` in messages
   - Features: General chat AI + image understanding (OCR, visual Q&A)

**Model initialization pattern (chat AI):**
- Uses `initPromiseRef` to deduplicate concurrent init calls (all callers wait on the same promise)
- Validates file size (>1MB) before loading; deletes corrupted file and calls `resetDownload` if invalid
- Loaded via `initLlama()` with platform-specific GPU config:
  - iOS: `n_gpu_layers: 99` (Metal acceleration)
  - Android: `n_gpu_layers: 0` (CPU only)
- Always call `context.release()` on cleanup to free memory

### In-App Purchase System

Premium language pack monetization:
- Free languages: English, Spanish, Chinese, French, German, Japanese
- Premium languages: $4.99 one-time unlock (promotional: $1.99)
- Product ID: `premium_languages_099`

**Key files:**
- `utils/purchase-manager.ts` - IAP logic using expo-in-app-purchases
- `utils/language-preferences.ts` - Language definitions with `isFree` flags
- `components/premium-languages-paywall.tsx` - Purchase modal
- `components/language-picker.tsx` - Language selection with lock icons
- `IAP_SETUP_GUIDE.md` - Complete setup instructions

**Usage pattern:**
```typescript
import { canUseLanguage } from '@/utils/purchase-manager';

// Check before translation
const hasAccess = await canUseLanguage(targetLanguageCode);
if (!hasAccess) {
  // Show paywall
}
```

### Speech Recognition & OCR

**Speech Recognition:**
- Library: `expo-speech-recognition`
- Used in conversation mode for real-time bidirectional translation
- Event-driven API with `useSpeechRecognitionEvent` hook
- Permissions required: `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`

**OCR (Text Recognition):**
- Library: `react-native-text-recognition`
- Camera integration: `expo-camera` with `CameraView`
- Workflow: Capture photo → Extract text → Translate
- Permissions required: `NSCameraUsageDescription`

### Chat Session Storage

Chat conversations are persisted via `utils/chat-storage.ts`:
- Storage key prefix: `@chat/` — e.g., `@chat/sessions`, `@chat/active_session_id`
- `ChatSession` type: `{ id, title, messages, createdAt, updatedAt }`
- Session title auto-generated from first user message (first 50 chars)
- Sessions sorted by `updatedAt` descending (most recent first)
- Key functions: `saveSession`, `loadSessions`, `deleteSession`, `getSession`, `setActiveSessionId`, `getActiveSessionId`, `clearAllSessions`

## Code Conventions

### Import Aliases

Use `@/*` for absolute imports:
```typescript
import { useTranslation } from '@/hooks/use-translation';
import { Colors } from '@/constants/theme';
```

Configured in `tsconfig.json`:
```json
"paths": { "@/*": ["./*"] }
```

### Language Data Structure

All languages defined in `utils/language-preferences.ts`:
```typescript
export const LANGUAGES = [
  { code: 'en', speechCode: 'en-US', name: 'English', isFree: true },
  { code: 'es', speechCode: 'es-ES', name: 'Spanish', isFree: true },
  // ...
];
export type Language = typeof LANGUAGES[number];
```

**Storage keys pattern:**
- Use `@translation/` prefix: `@translation/source_language`, `@translation/target_language`
- Stored as JSON strings via AsyncStorage

### Chat AI Model Lifecycle Pattern

The chat AI hook uses `initPromiseRef` to deduplicate concurrent init calls:
```typescript
const contextRef = useRef<LlamaContext | null>(null);
const initPromiseRef = useRef<Promise<void> | null>(null);

const initializeModel = useCallback(async () => {
  if (contextRef.current) return; // Already initialized
  if (initPromiseRef.current) return initPromiseRef.current; // In-flight: all callers share same promise

  const doInit = async () => {
    try {
      // Validate file size, then call initLlama() + initMultimodal()
      contextRef.current = llamaCtx;
    } finally {
      initPromiseRef.current = null;
    }
  };

  initPromiseRef.current = doInit();
  return initPromiseRef.current;
}, []);
```

**Important:** Always call `context.release()` on cleanup to free memory.

### Themed Components

Use `ThemedText` and `ThemedView` for automatic dark mode support:
```typescript
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// These components automatically use Colors[colorScheme]
<ThemedView>
  <ThemedText>Auto-themed content</ThemedText>
</ThemedView>
```

Theme colors defined in `constants/theme.ts` (inferred from usage).

### Chat AI Prompt Format

**LFM2.5 ChatML format** (used by both `useChatAI` hook and `ChatAIContext`):
```typescript
let prompt = `<|startoftext|><|im_start|>system\n${systemMessage}<|im_end|>\n`;
// for each message:
prompt += `<|im_start|>user\n${content}<|im_end|>\n`;
prompt += `<|im_start|>assistant\n${content}<|im_end|>\n`;
// final turn:
prompt += '<|im_start|>assistant\n';
```
Stop tokens: `['<|im_end|>', '<|endoftext|>']`

For vision requests, pass messages directly with `image_url` content type — do not use the manual prompt string.

### Platform-Specific Configuration

iOS requires special entitlements in `app.json` for AI models:
```json
"ios": {
  "entitlements": {
    "com.apple.developer.kernel.increased-memory-limit": true,
    "com.apple.developer.kernel.extended-virtual-addressing": true
  }
}
```

Android uses predictive back gesture disabled:
```json
"android": {
  "predictiveBackGestureEnabled": false
}
```

### llama.rn Plugin Configuration

The `llama.rn` plugin requires specific setup in `app.json`:
```json
"plugins": [
  [
    "llama.rn",
    {
      "enableEntitlements": true,
      "entitlementsProfile": "production",
      "forceCxx20": true,
      "enableOpenCLAndHexagon": true
    }
  ]
]
```

**Note:** After modifying plugin config, run `npx expo prebuild --clean` to regenerate native projects.

## Development Workflow

### Adding a New AI Chat Model

1. Upload GGUF + mmproj files to HuggingFace (or another host)
2. Update `MODEL_CONFIGS` in `contexts/download-manager-context.tsx` with new URLs and filenames
3. Update `MODEL_FILENAME` / `MMPROJ_FILENAME` constants in `contexts/chat-ai-context.tsx` and `hooks/use-chat-ai.ts`
4. Update prompt format in `generateResponse` if the new model uses a different chat template
5. Test download + initialization on both iOS and Android

### Adding a New Language

1. Add language object to `LANGUAGES` in `utils/language-preferences.ts`
2. Set `isFree: true` for free tier, `false` for premium
3. Ensure `speechCode` matches iOS/Android speech recognition locale codes
4. No code changes needed elsewhere - language picker automatically updates

### Testing IAP

See `IAP_SETUP_GUIDE.md` for complete setup instructions.

**Quick test on development:**
1. Create sandbox accounts in App Store Connect / Play Console
2. Build with `npx eas build --profile preview`
3. Install on physical device (IAP doesn't work in simulators)
4. Test purchase flow without actual charges

## Important Notes

- **OTA Updates:** `hooks/use-ota-updates.ts` auto-checks on mount and app foreground; `utils/ota-updates.ts` provides `manualUpdateCheck()` for settings screens
- **New Architecture:** Enabled via `newArchEnabled: true` - uses React Native's new architecture
- **React Compiler:** Experimental React Compiler enabled via `experiments.reactCompiler: true`
- **Patch Package:** Uses `patch-package` for npm dependency patches (runs via `postinstall` script)
- **EAS Build:** Project ID `d36df05f-69d4-43e8-b80e-eac52832ffc6` configured in app.json
- **File Storage:** All model files stored in `Paths.document` (expo-file-system)

## Performance Considerations

- Chat model (~1.6GB model + ~0.3GB mmproj) — first-time download takes several minutes
- Model initialization can take 10-30 seconds on older devices
- Metal acceleration (iOS) significantly improves inference speed
- Android performance varies widely by device (CPU-only inference)
- Use `use_mlock: true` to prevent model paging on iOS
- Translation via ML Kit is fast and requires no warm-up; language model files download on first use per language pair
