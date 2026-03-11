# In-App Purchase Setup Guide

## Overview
This app now supports premium language packs where:
- ✅ Multiple languages are FREE forever
- 💎 All other languages require a **one-time purchase of $4.99 USD** (currently on limited offer for $1.99)

## Files Added/Modified

### New Files:
1. **`utils/purchase-manager.ts`** - Handles all IAP logic
2. **`components/premium-languages-paywall.tsx`** - Paywall modal
3. **`components/language-picker.tsx`** - Language picker with lock icons
4. **`EXAMPLE_USAGE.tsx`** - Integration examples

### Modified Files:
1. **`utils/language-preferences.ts`** - Added `isFree` property to languages
2. **`app.json`** - Added billing permission for Android

## Setup Steps

### 1. App Store Connect (iOS)

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select your app
3. Go to **Features** → **In-App Purchases**
4. Click **+** to create a new in-app purchase
5. Select **Non-Consumable**
6. Configure:
   - **Product ID**: `premium_languages_099`
   - **Reference Name**: Premium Languages
   - **Price**: $4.99 USD (with promotional price of $1.99)
   - **Cleared for Sale**: YES
7. Add localizations and screenshots
8. Submit for review

### 2. Google Play Console (Android)

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app
3. Go to **Monetize** → **In-app products**
4. Click **Create product**
5. Configure:
   - **Product ID**: `premium_languages_099`
   - **Name**: Premium Languages Pack
   - **Description**: Unlock 30+ premium languages
   - **Status**: Active
   - **Price**: $4.99 USD (with promotional price of $1.99)
6. Save and activate

### 3. Testing with Sandbox

#### iOS Sandbox Testing:
1. Go to **Settings** → **App Store** → **Sandbox Account**
2. Add a test account from App Store Connect
3. Install your app via TestFlight or development build
4. Attempt purchase - use sandbox account credentials
5. Payment won't actually charge

#### Android Testing:
1. In Play Console, go to **Setup** → **License testing**
2. Add test Gmail accounts
3. Upload app to Internal Testing track
4. Install on device with test account
5. Test purchases (won't be charged)

### 4. Integration in Your App

Replace your current language selection UI with the new components:

```tsx
import { LanguagePicker } from '@/components/language-picker';
import { PremiumLanguagesPaywall } from '@/components/premium-languages-paywall';
import { useState } from 'react';

function YourScreen() {
  const [showPicker, setShowPicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  return (
    <>
      {/* Your UI */}
      
      <LanguagePicker
        visible={showPicker}
        selectedLanguage={currentLanguage}
        onSelect={setLanguage}
        onClose={() => setShowPicker(false)}
        onShowPaywall={() => {
          setShowPicker(false);
          setShowPaywall(true);
        }}
      />

      <PremiumLanguagesPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchaseComplete={() => {
          // Refresh your state
        }}
      />
    </>
  );
}
```

### 5. Check Purchase Status Before Translation

In your translation logic, verify language access:

```tsx
import { canUseLanguage } from '@/utils/purchase-manager';

async function handleTranslation(targetLanguageCode: string) {
  const hasAccess = await canUseLanguage(targetLanguageCode);
  
  if (!hasAccess) {
    // Show paywall
    setShowPaywall(true);
    return;
  }
  
  // Proceed with translation
  // ...
}
```

### 6. Initialize IAP on App Start

In your root layout or app component:

```tsx
import { initializePurchases, disconnectPurchases } from '@/utils/purchase-manager';
import { useEffect } from 'react';

function RootLayout() {
  useEffect(() => {
    initializePurchases();
    
    return () => {
      disconnectPurchases();
    };
  }, []);
  
  // ...
}
```

## Important Notes

### Before Publishing:

1. **Test thoroughly** with sandbox accounts
2. **Enable** in-app purchases in App Store Connect
3. **Activate** products in Google Play Console
4. **Add** purchase restore functionality (already included)
5. **Update** privacy policy to mention purchases
6. **Add** screenshots showing premium features

### Revenue Considerations:

- Apple takes 30% (you get $1.39 per sale at promotional price, $3.49 at regular price)
- Google takes 30% (you get $1.39 per sale at promotional price, $3.49 at regular price)
- After 1 year: 15% fee (you get $1.69 at promotional price, $4.24 at regular price)

### Legal Requirements:

1. Add to your **Privacy Policy**: "In-app purchases available for premium features"
2. Add to **Terms of Service**: Non-refundable purchase policy
3. Provide **support email** for purchase issues

## Troubleshooting

### "Product not found" error:
- Wait 2-4 hours after creating product in store consoles
- Ensure product ID matches exactly: `premium_languages_099`
- Check product is marked as "Cleared for Sale" (iOS) or "Active" (Android)

### Purchase not restoring:
- Verify user is signed in with same account
- Check `getPurchaseHistoryAsync()` implementation
- Ensure proper receipt validation

### Testing issues:
- Clear app data and reinstall
- Sign out and back into sandbox account
- Check sandbox account is valid and active

## Next Steps

1. ✅ Install dependencies (already done)
2. ⬜ Set up products in App Store Connect
3. ⬜ Set up products in Google Play Console  
4. ⬜ Create sandbox/test accounts
5. ⬜ Integrate components into your screens
6. ⬜ Test with sandbox accounts
7. ⬜ Update privacy policy
8. ⬜ Submit for review

## Support

If users have purchase issues, you can:
1. Direct them to "Restore Purchase" button
2. Verify receipt via email support
3. Manually grant access (store in AsyncStorage)

Good luck with your launch! 🚀
