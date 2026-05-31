import * as SecureStore from "expo-secure-store";
import type { TokenPair } from "@/api/client";

const ACCESS_KEY = "pos_mobile_access";
const REFRESH_KEY = "pos_mobile_refresh";
const EXPIRES_KEY = "pos_mobile_expires";

export async function loadStoredTokens(): Promise<TokenPair | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  const expiresRaw = await SecureStore.getItemAsync(EXPIRES_KEY);
  if (!accessToken || !refreshToken) return null;
  return {
    accessToken,
    refreshToken,
    expiresIn: Number(expiresRaw ?? "0") || 0,
  };
}

export async function saveStoredTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  await SecureStore.setItemAsync(EXPIRES_KEY, String(tokens.expiresIn));
}

export async function clearStoredTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(EXPIRES_KEY);
}
