import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product, Purchase } from 'expo-iap';
import {
    ErrorCode,
    endConnection,
    fetchProducts,
    finishTransaction,
    getAvailablePurchases,
    initConnection,
    purchaseErrorListener,
    purchaseUpdatedListener,
    requestPurchase,
} from 'expo-iap';
import { LANGUAGES } from './language-preferences';

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
    const connected = await initConnection();
    console.log('IAP Connected:', connected);
  } catch (error: any) {
    if (error?.code === ErrorCode.AlreadyPrepared) {
      console.log('IAP Already connected (this is fine)');
    } else {
      console.error('Connection error:', error);
    }
  }

  try {
    const products = await fetchProducts({ skus: [PRODUCT_ID], type: 'in-app' });
    console.log('Products Found:', products.length);
    console.log('Products:', JSON.stringify(products, null, 2));
  } catch (error) {
    console.error('Products error:', error);
  }
  console.log('=== END DEBUG ===');
};

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
  const language = LANGUAGES.find(lang => lang.code === languageCode);
  return language?.isFree ?? false;
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
    await initConnection();
  } catch (error: any) {
    if (error?.code !== ErrorCode.AlreadyPrepared) {
      console.error('Failed to initialize purchases:', error);
    }
  }
};

// Disconnect IAP
export const disconnectPurchases = async (): Promise<void> => {
  try {
    await endConnection();
  } catch (error) {
    console.error('Failed to disconnect purchases:', error);
  }
};

// Get available products
export const getProducts = async (): Promise<Product[]> => {
  try {
    const products = await fetchProducts({ skus: [PRODUCT_ID], type: 'in-app' });
    console.log('Products found:', JSON.stringify(products, null, 2));
    if (products.length === 0) {
      console.warn('⚠️ No products found! Product ID might be wrong or product not ready yet.');
    }
    return products;
  } catch (error) {
    console.error('Failed to get products:', error);
    return [];
  }
};

// Purchase premium languages
export const purchasePremiumLanguages = async (): Promise<{ success: boolean; error?: string }> => {
  console.log('Querying products before purchase...');
  const products = await getProducts();

  if (products.length === 0) {
    return { success: false, error: 'Product not available. Please try again later.' };
  }

  console.log('Products loaded, attempting purchase...');

  return new Promise((resolve) => {
    const purchaseSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      if (purchase.productId === PRODUCT_ID) {
        purchaseSub.remove();
        errorSub.remove();
        try {
          await finishTransaction({ purchase, isConsumable: false });
          await setPremiumLanguagesPurchased();
          resolve({ success: true });
        } catch (err: any) {
          console.error('Failed to finish transaction:', err);
          resolve({ success: false, error: err?.message || 'Failed to complete purchase' });
        }
      }
    });

    const errorSub = purchaseErrorListener((error: any) => {
      if (error?.productId === PRODUCT_ID || !error?.productId) {
        purchaseSub.remove();
        errorSub.remove();
        if (error?.code === ErrorCode.UserCancelled) {
          resolve({ success: false, error: 'Purchase was cancelled' });
        } else {
          resolve({ success: false, error: error?.message || 'Purchase failed' });
        }
      }
    });

    requestPurchase({
      request: {
        apple: { sku: PRODUCT_ID },
        google: { skus: [PRODUCT_ID] },
      },
      type: 'in-app',
    }).catch((err: any) => {
      purchaseSub.remove();
      errorSub.remove();
      console.error('requestPurchase error:', err);
      if (err?.code === ErrorCode.UserCancelled) {
        resolve({ success: false, error: 'Purchase was cancelled' });
      } else {
        resolve({ success: false, error: err?.message || 'Purchase failed' });
      }
    });
  });
};

// Restore purchases
export const restorePurchases = async (): Promise<boolean> => {
  try {
    const purchases = await getAvailablePurchases();
    const hasPremiumPurchase = purchases.some(
      (purchase) => purchase.productId === PRODUCT_ID
    );
    if (hasPremiumPurchase) {
      await setPremiumLanguagesPurchased();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    return false;
  }
};

// Listen for purchase updates — returns a cleanup function
export const setupPurchaseListener = (
  onPurchaseUpdate: (purchase: Purchase) => void
): (() => void) => {
  const subscription = purchaseUpdatedListener((purchase: Purchase) => {
    if (purchase.productId === PRODUCT_ID) {
      setPremiumLanguagesPurchased();
      onPurchaseUpdate(purchase);
    }
  });
  return () => subscription.remove();
};
