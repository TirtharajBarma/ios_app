let AsyncStorageInstance: any = null;

try {
  AsyncStorageInstance = require("@react-native-async-storage/async-storage").default;
} catch (e) {
  console.warn("AsyncStorage native module not found, using memory fallback.");
}

// Fallback to memory storage if native AsyncStorage is null or failed to load
if (!AsyncStorageInstance) {
  const cache: Record<string, string> = {};
  AsyncStorageInstance = {
    getItem: async (key: string): Promise<string | null> => {
      return cache[key] || null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      cache[key] = value;
    },
    removeItem: async (key: string): Promise<void> => {
      delete cache[key];
    },
    clear: async (): Promise<void> => {
      Object.keys(cache).forEach((k) => delete cache[k]);
    },
  };
}

export default AsyncStorageInstance;
