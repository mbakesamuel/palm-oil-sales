---
name: Login loading UI
overview: Add a visible loading indicator on the sign-in button and keep the form in a loading state through successful navigation to the dashboard by only clearing `busy` on failure, reusing the existing `busy` flag in [LoginForm.tsx](c:/Users/user/Desktop/sales-project/pos-app/app/login/LoginForm.tsx).
todos:
  - id: spinner-button
    content: Add Loader2 + flex layout to submit button when busy
    status: completed
  - id: busy-lifecycle
    content: Clear busy only on error/throw; leave true on successful push
    status: completed
  - id: optional-inputs
    content: Disable username/password inputs while busy (optional)
    status: completed
isProject: false
---

# Login button loading state

## Current behavior

[`app/login/LoginForm.tsx`](c:/Users/user/Desktop/sales-project/pos-app/app/login/LoginForm.tsx) already sets `busy` to `true` before `loginWithCredentials` and uses `finally { setBusy(false) }`, so the button returns to normal **immediately after** `router.push("/dashboard")` is invoked—not after the new route finishes rendering. That creates a short gap where the UI looks idle while Next.js is still navigating.

```22:36:c:/Users/user/Desktop/sales-project/pos-app/app/login/LoginForm.tsx
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await loginWithCredentials(username, password);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      signIn(r.session);
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  }
```

No other login UI changes are required server-side; [`app/login/actions.ts`](c:/Users/user/Desktop/sales-project/pos-app/app/login/actions.ts) is unchanged.

## Implementation

1. **Spinner on the submit control**  
   Import `Loader2` from `lucide-react` (already used elsewhere, e.g. [`app/forbidden/SignOutButton.tsx`](c:/Users/user/Desktop/sales-project/pos-app/app/forbidden/SignOutButton.tsx)). When `busy`, render a small icon with Tailwind `animate-spin` (standard pattern; no new dependencies).

2. **Button layout**  
   Use a horizontal flex on the button (`inline-flex items-center justify-center gap-2`) so the spinner sits beside “Signing in…” and stays centered.

3. **Keep loading through successful navigation**  
   Remove the unconditional `finally { setBusy(false) }`. Instead:
   - On **failed** login (`!r.ok`): set error, then `setBusy(false)`, `return`.
   - On **thrown** errors (unexpected): `setBusy(false)` in `catch` if you add one, or after handling.
   - On **success**: call `signIn`, then `router.push("/dashboard")`, and **do not** call `setBusy(false)`—the login page client tree unmounts when the dashboard loads, so the stuck-loading edge case only matters if navigation never occurs (rare); optional later hardening: a long `setTimeout` fallback.

4. **Optional polish (same file, low risk)**  
   Set `disabled={busy}` on the username/password inputs so users cannot edit fields mid-request (matches disabled submit).

5. **Accessibility**  
   Optionally add `aria-busy={busy}` on the `<form>` and `aria-live="polite"` on the error region (only if you want screen readers to announce busy state; not strictly required for the visual ask).

## Files touched

- **[`app/login/LoginForm.tsx`](c:/Users/user/user/Desktop/sales-project/pos-app/app/login/LoginForm.tsx)** — spinner import, button JSX, `onSubmit` control flow for `busy`.

No new components or global CSS unless you prefer a dedicated `LoginSubmitButton` (not necessary for this scope).
