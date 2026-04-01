# OfflineGPT Development Guide

## Project Overview

OfflineGPT is a React Native/Expo mobile app that provides **fully offline AI translation and chat** using on-device LLM models. The app uses [llama.rn](https://github.com/mybigday/llama.rn) to run quantized GGUF models directly on iOS/Android devices.

**Key capabilities:**
- Text, image (OCR), and voice translation between 35+ languages
- Real-time bidirectional conversation translation
- Offline chat AI
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
- `app/(tabs)/translate.tsx` - Main screen with 3 modes: text translation, camera OCR, and conversation
- `app/modal.tsx` - Example modal screen

**Typed routes enabled** via `experiments.typedRoutes: true` in app.json.

### Context Architecture

The app uses React Context for global state management:

1. **DownloadManagerContext** (`contexts/download-manager-context.tsx`)
   - Manages downloading of AI models (translation + chat) from CDN
   - Tracks download progress and cancellation
   - Models stored in `FileSystem.documentDirectory`

2. **TranslationContext** (`contexts/translation-context.tsx`)
   - Wraps `useTranslation` hook and provides global access
   - Manages 4 language preferences: source/target (text mode) and my/opponent (conversation mode)
   - Persists language selections to AsyncStorage
   - Handles translation model initialization and lifecycle

**Context provider hierarchy** (defined in `app/_layout.tsx`):
```
ThemeProvider
└─ DownloadManagerProvider
   └─ TranslationProvider
      └─ App content
```

### AI Model System

The app uses two separate on-device LLM models:

1. **Translation Model:** `translategemma-4b-it.Q4_K_S.gguf` (~2.6GB)
   - Hook: `hooks/use-translation.ts`
   - Model: Google's TranslateGemma-4B (quantized)
   - Prompt format: `<s> Translate this into {targetLang}: {sourceText} {targetLang}: `
   - Features: Text translation, OCR translation

2. **Chat Model:** `llama-3.2-1b-instruct-q8_0.gguf` (~1.3GB)
   - Hook: `hooks/use-chat-ai.ts`
   - Model: Llama 3.2 1B Instruct (8-bit quantized)
   - Prompt format: Llama 3 Instruct template
   - Features: General chat AI functionality

**Model initialization pattern:**
- Models are lazily loaded when first needed
- Downloaded from CDN if not present (`MODEL_CONFIGS` in download-manager-context)
- Loaded via `initLlama()` from llama.rn with platform-specific configs:
  - iOS: `n_gpu_layers: 99` (Metal acceleration)
  - Android: `n_gpu_layers: 0` (CPU only)
- Both hooks use `contextRef` to maintain single model instance
- Use `isInitializingRef` to prevent concurrent initialization

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

### Model Lifecycle Pattern

Both translation and chat AI hooks follow this pattern:
```typescript
const contextRef = useRef<LlamaContext | null>(null);
const isInitializingRef = useRef(false);

const initializeModel = useCallback(async () => {
  if (contextRef.current) return; // Already initialized
  if (isInitializingRef.current) return; // Already initializing
  
  try {
    isInitializingRef.current = true;
    // Download model if needed
    // Initialize with initLlama()
    contextRef.current = context;
  } finally {
    isInitializingRef.current = false;
  }
}, [dependencies]);
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

### Translation Prompt Format

**Critical:** TranslateGemma requires specific prompt structure:
```typescript
const prompt = `<s> Translate this into ${targetLang}: ${sourceText} ${targetLang}: `;
```

- Must start with `<s>` token
- Include target language name twice
- Space after final colon is important

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

### Adding a New AI Model

1. Upload GGUF model to CDN: `https://offlinegpt-assets.orangolabs.com/`
2. Add config to `MODEL_CONFIGS` in `contexts/download-manager-context.tsx`
3. Create hook in `hooks/` following `use-translation.ts` pattern
4. Add context if global access needed
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

- **OTA Updates:** Configured via Expo Updates (`expo-updates`) with runtime version `1.0.0`
- **New Architecture:** Enabled via `newArchEnabled: true` - uses React Native's new architecture
- **React Compiler:** Experimental React Compiler enabled via `experiments.reactCompiler: true`
- **Patch Package:** Uses `patch-package` for npm dependency patches (runs via `postinstall` script)
- **EAS Build:** Project ID `d36df05f-69d4-43e8-b80e-eac52832ffc6` configured in app.json
- **File Storage:** All model files stored in `Paths.document` (FileSystem.documentDirectory)

## Performance Considerations

- Translation model is ~2.6GB - first-time download takes several minutes
- Model initialization can take 10-30 seconds on older devices
- Metal acceleration (iOS) significantly improves inference speed
- Android performance varies widely by device (CPU-only inference)
- Use `use_mlock: true` to prevent model paging on iOS
