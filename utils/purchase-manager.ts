import AsyncStorage from '@react-native-async-storage/async-storage';
import * as InAppPurchases from 'expo-in-app-purchases';

const STORAGE_KEY = '@premium_languages_purchased';
// Try one of these Product IDs if 'premium_languages_099' doesn't work:
// Option 1: com.holfun.offlinegpt.premium_languages
// Option 2: premium_languages
// Option 3: premium_languages_099 (current)
const PRODUCT_ID = 'premium_languages_099'; // You'll configure this in App Store Connect / Play Console

// Add debug function
export const debugIAP = async () => {
  console.log('=== IAP DEBUG INFO ===');
  console.log('Product ID:', PRODUCT_ID);
  
  try {
    const connected = await InAppPurchases.connectAsync();
    console.log('IAP Connected:', connected);
  } catch (error) {
    console.error('Connection error:', error);
  }
  
  try {
    const { results, responseCode } = await InAppPurchases.getProductsAsync([PRODUCT_ID]);
    console.log('Response Code:', responseCode);
    console.log('Response Code Values:', {
      OK: InAppPurchases.IAPResponseCode.OK,
      USER_CANCELED: InAppPurchases.IAPResponseCode.USER_CANCELED,
      ERROR: InAppPurchases.IAPResponseCode.ERROR,
    });
    console.log('Products Found:', results?.length || 0);
    console.log('Products:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Products error:', error);
  }
  console.log('=== END DEBUG ===');
};

// Free languages - English and Spanish
export const FREE_LANGUAGES = ['en', 'es'];

// Check if premium languages have been purchased
export const hasPurchasedPremiumLanguages = async (): Promise<boolean> => {
  try {
    const purchased = await AsyncStorage.getItem(STORAGE_KEY);
    return purchased === 'true';
  } catch (error) {
    console.error('Failed to check purchase status:', error);
    return false;
  }
};

// Mark premium languages as purchased
export const setPremiumLanguagesPurchased = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
  } catch (error) {
    console.error('Failed to save purchase status:', error);
  }
};

// Check if a language is free
export const isLanguageFree = (languageCode: string): boolean => {
  return FREE_LANGUAGES.includes(languageCode);
};

// Check if user can use a specific language
export const canUseLanguage = async (languageCode: string): Promise<boolean> => {
  if (isLanguageFree(languageCode)) {
    return true;
  }
  return await hasPurchasedPremiumLanguages();
};

// Initialize IAP connection
export const initializePurchases = async (): Promise<void> => {
  try {
    await InAppPurchases.connectAsync();
  } catch (error) {
    console.error('Failed to initialize purchases:', error);
  }
};

// Disconnect IAP
export const disconnectPurchases = async (): Promise<void> => {
  try {
    await InAppPurchases.disconnectAsync();
  } catch (error) {
    console.error('Failed to disconnect purchases:', error);
  }
};

// Get available products
export const getProducts = async (): Promise<InAppPurchases.IAPItemDetails[]> => {
  try {
    const { results, responseCode } = await InAppPurchases.getProductsAsync([PRODUCT_ID]);
    console.log('Products response code:', responseCode);
    console.log('Products found:', JSON.stringify(results, null, 2));
    
    if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
      if (results.length === 0) {
        console.warn('⚠️ No products found! Product ID might be wrong or product not ready yet.');
      }
      return results;
    } else {
      console.error('Failed to fetch products, response code:', responseCode);
      return [];
    }
  } catch (error) {
    console.error('Failed to get products:', error);
    return [];
  }
};

// Purchase premium languages
export const purchasePremiumLanguages = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    // MUST query products from store first before purchasing
    console.log('Querying products before purchase...');
    const products = await getProducts();
    
    if (products.length === 0) {
      return { success: false, error: 'Product not available. Please try again later.' };
    }
    
    console.log('Products loaded, attempting purchase...');
    // purchaseItemAsync returns void and triggers the purchase flow
    // Success/failure is handled through setPurchaseListener
    await InAppPurchases.purchaseItemAsync(PRODUCT_ID);
    
    // If we reach here without throwing, the purchase was initiated successfully
    // The actual purchase confirmation comes through the listener
    await setPremiumLanguagesPurchased();
    return { success: true };
  } catch (error: any) {
    console.error('Purchase error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Check if user cancelled
    if (error?.message?.includes('cancel') || error?.code === 'USER_CANCELLED') {
      return { success: false, error: 'Purchase was cancelled' };
    }
    
    return { success: false, error: error?.message || 'Purchase failed' };
  }
};

// Restore purchases
export const restorePurchases = async (): Promise<boolean> => {
  try {
    const { results } = await InAppPurchases.getPurchaseHistoryAsync({ useGooglePlayCache: false });
    
    if (results) {
      const hasPremiumPurchase = results.some(
        purchase => purchase.productId === PRODUCT_ID
      );
      
      if (hasPremiumPurchase) {
        await setPremiumLanguagesPurchased();
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    return false;
  }
};

// Listen for purchase updates
export const setupPurchaseListener = (
  onPurchaseUpdate: (purchase: InAppPurchases.InAppPurchase) => void
) => {
  InAppPurchases.setPurchaseListener((result: InAppPurchases.IAPQueryResponse<InAppPurchases.InAppPurchase>) => {
    if (result.responseCode === InAppPurchases.IAPResponseCode.OK && result.results) {
      result.results.forEach((purchase: InAppPurchases.InAppPurchase) => {
        if (purchase.productId === PRODUCT_ID) {
          setPremiumLanguagesPurchased();
          onPurchaseUpdate(purchase);
        }
      });
    }
  });
};
