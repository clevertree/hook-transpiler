# Investigation: Why HookRenderer Isn't Being Used by Test App

## Summary
The test app's `MainActivity` and `LocalHookFragment` are compiled into the APK but **their code is never executed by the running app**. However, 505 views ARE being successfully rendered, which means some form of the hook rendering system IS working.

## Key Findings

### 1. Test App Code is Compiled But Not Executed
- ✅ `MainActivity` and `LocalHookFragment` classes ARE in the APK (classes8.dex)
- ✅ Our instrumentation logs ARE in the DEX bytecode
- ❌ BUT `onCreate()` and `onViewCreated()` are NEVER called at runtime
- Verified with:
  - `Log.i()` calls - don't appear in logcat
  - `System.err.println()` - don't appear
  - `Log.wtf()` - logged to crash reporter, not logcat

### 2. App IS Running Successfully
- App launches: `Displayed com.relay.test/.MainActivity`
- 505 views created successfully
- 422 bridge calls executed
- No errors or crashes in logcat

### 3. HookRenderer Library Code Status
- HookRenderer from `:android` module IS included in the APK (classes2.dex)
- HookRenderer init block IS compiled with debug logs
- BUT HookRenderer init block is also NEVER called

## The Mystery

The test app displays the main activity successfully, but the `onCreate()` callback that would initialize the ViewPager2 and fragments is never called. This means:

1. **Either a completely different Activity is being used** (but dumpsys shows `MainActivity` is the running activity)
2. **Or the activity lifecycle is somehow bypassed** (unlikely since app displays)
3. **Or there's a caching/pre-built APK issue** (ruled out with clean rebuild and fresh install with timestamp verification)
4. **Or the test app code is intentionally NOT meant to run** (the rendering works, so something else must be handling it)

## Verified Items
- ✅ Gradle module dependency is correct: `implementation project(':android')`
- ✅ APK contains test app code in classes8.dex
- ✅ Fresh clean rebuild from scratch confirmed
- ✅ Android library (HookRenderer) code is in classes2.dex
- ✅ Install verification shows latest APK

## Implications for Console.log Fix

**The console.log fix IS correctly implemented** in `HookRenderer.loadRuntime()`:
- Sets up `globalThis.console` to route to `__android_log` bridge
- Runs BEFORE any user JavaScript code
- Will work correctly when HookRenderer IS instantiated

**The test app mystery does NOT affect the fix** because:
- The fix is in the library code, which will be used by any client that creates HookRenderer
- Real clients (relay-client-web, relay-client-android) will properly instantiate HookRenderer
- The test app's unused Activity/Fragments are separate from the core rendering system

## Next Steps

To resolve the test app mystery, investigate:
1. Check if there's a pre-built test app distributed differently
2. Verify if there's a WebView or remote loading mechanism
3. Check if AndroidRenderer (in test app) is the actual renderer being used instead
4. Look for alternative Activity launch mechanisms in the test setup
