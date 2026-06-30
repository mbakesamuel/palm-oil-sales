import { useState } from "react";

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthProvider";

import { describeApiConnection, getApiBaseUrl } from "@/api/client";

import { Logo } from "@/components/Logo";
import { ButtonSkeleton } from "@/components/skeleton";

import { agro } from "@/theme/agro";

export default function LoginScreen() {
  const { login } = useAuth();

  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);

    setBusy(true);

    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,

          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandMark}>
          <Logo width={110} />
        </View>

        <Text style={styles.title}>Sales Mobile</Text>

        <Text style={styles.subtitle}>
          (Manage sales operations from one platform)
        </Text>

        {getApiBaseUrl() ? (
          <Text style={styles.apiHint}>{describeApiConnection()}</Text>
        ) : null}

        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {busy ? (
          <ButtonSkeleton />
        ) : (
          <Pressable style={styles.button} onPress={onSubmit}>
            <Text style={styles.buttonText}>Sign in</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: agro.cream },

  container: {
    flexGrow: 1,

    justifyContent: "center",

    padding: 24,
  },

  brandMark: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#e8f0e4",
  },

  title: {textAlign:"center", fontSize: 28, fontWeight: "700", marginBottom: 4, color: agro.text },

  subtitle: { textAlign:"center", fontSize: 14, color: agro.textMuted, marginBottom: 8 },

  apiHint: { fontSize: 11, color: agro.textSoft, marginBottom: 16 },

  input: {
    borderWidth: 1,

    borderColor: agro.border,

    borderRadius: 12,

    padding: 14,

    marginBottom: 12,

    backgroundColor: agro.panel,

    color: agro.text,
  },

  button: {
    backgroundColor: agro.forest,

    borderRadius: 12,

    padding: 14,

    alignItems: "center",

    marginTop: 8,
  },

  buttonText: { color: "#fff", fontWeight: "600" },

  error: { color: agro.danger, marginBottom: 8 },
});
