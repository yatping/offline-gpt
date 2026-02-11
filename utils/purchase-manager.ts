import AsyncStorage from '@react-native-async-storage/async-storage';
import * as InAppPurchases from 'expo-in-app-purchases';

const STORAGE_KEY = '@premium_languages_purchased';
const PRODUCT_ID = 'premium_languages_099'; // You'll configure this in App Store Connect / Play Console

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
export const getProducts = async (): Promise<InAppPurchases.InAppPurchase[]> => {
  try {
    const { results } = await InAppPurchases.getProductsAsync([PRODUCT_ID]);
    return results || [];
  } catch (error) {
    console.error('Failed to get products:', error);
    return [];
  }
};

// Purchase premium languages
export const purchasePremiumLanguages = async (): Promise<boolean> => {
  try {
    await InAppPurchases.purchaseItemAsync(PRODUCT_ID);
    await setPremiumLanguagesPurchased();
    return true;
  } catch (error) {
    console.error('Purchase failed:', error);
    return false;
  }
};

// Restore purchases
export const restorePurchases = async (): Promise<boolean> => {
  try {
    const { results } = await InAppPurchases.getPurchaseHistoryAsync();
    
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
  InAppPurchases.setPurchaseListener(({ responseCode, results }) => {
    if (responseCode === InAppPurchases.IAPResponseCode.OK) {
      results?.forEach((purchase) => {
        if (purchase.productId === PRODUCT_ID) {
          setPremiumLanguagesPurchased();
          onPurchaseUpdate(purchase);
        }
      });
    }
  });
};
