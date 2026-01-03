# React Native Renderer - Quick Start Guide

## Overview
The hook-transpiler now supports two rendering backends: **Act** (original) and **React Native** (new). Switch between them at runtime to debug rendering issues.

## Using the Toggle

### In the App
1. Build and run the test app: `cd tests/android && ./gradlew installDebug`
2. Open the app → "Local Hook Test" tab
3. Two buttons at the top:
   - **"Act (default)"** - Original Act renderer
   - **"React (test)"** - New React Native renderer
4. Click either button to switch renderers
5. Click "Load Local Hook" to render the test hook
6. Check the status log to see which renderer was used and how many native views were created

### What to Expect

**With Act (original):**
- Uses act-android.bundle.js
- Currently creates 0 native views (known issue)
- Logs show "Bridge method call count: 0"

**With React Native (new):**
- Uses react-native.bundle.js
- Should create native views for the hook
- Logs show "Bridge method call count: N" (should be > 0)

## Diagnostic Logs

When you load a hook, check the "Status Log" for:

```
[PRE-RENDER DIAGNOSTICS]
Renderer: Act (or ReactNative)
Bridge available: YES
Bridge.createView: OK
Bridge.addChild: OK
[RENDER] Calling Act.render with Component
[RENDER] Completed (no error thrown)
[POST-RENDER] Bridge method call count: N
```

## Comparing Results

### View Count Comparison
- Open hook with **Act** → note view count in log
- Switch to **React Native** → load same hook → compare view counts
- If React Native creates more views → suggests Act has rendering issue
- If both create same number → suggest both working or both broken equally

### Bridge Call Count Comparison
- Act currently shows: "Bridge method call count: 0" (issue!)
- React Native should show: "Bridge method call count: N" where N > 0

## Files Changed

- **Created:** `android/src/main/assets/react-native.bundle.js`
  - Complete React-like rendering engine
  - Implements hooks (useState, useEffect, etc.)
  - Converts vnodes to native views via bridge

- **Modified:** `android/src/main/kotlin/com/clevertree/hooktranspiler/render/HookRenderer.kt`
  - `loadRuntime()` now loads Act or React Native based on mode
  - `executeJs()` detects and uses appropriate renderer
  - `setRendererMode()` reinitializes engine when switching

- **UI Already Present:** `tests/android/app/src/main/java/com/relay/test/LocalHookFragment.kt`
  - Button handlers already wired to renderer toggle
  - No changes needed

## Implementation Details

### The Bridge
Both renderers use the same bridge interface:
```kotlin
bridge.createView(tag, type, props)    // Create native view
bridge.addChild(parent, child)         // Add child to parent
bridge.updateProps(tag, props)         // Update view properties
bridge.removeChild(parent, child)      // Remove child
bridge.clearViews()                    // Clear all views
```

### React Native Hooks
Full implementation of:
- `useState(initialValue)` - State management
- `useEffect(fn, deps)` - Side effects
- `useContext(context)` - Context API
- `useReducer(reducer, initial)` - Advanced state
- `useCallback(fn, deps)` - Memoized callbacks
- `useMemo(fn, deps)` - Memoized values
- `useRef(initial)` - Refs

### Error Handling
If React Native encounters an error during rendering:
- Logs the error to console
- Creates a fallback Text view with error message
- Does not crash the app

## Testing Procedure

### Test 1: Basic Rendering
1. Open app → Local Hook Test tab
2. Make sure "Act (default)" is selected
3. Click "Load Local Hook"
4. Note: Currently renders 0 views (known issue)
5. Click "React (test)"
6. Click "Load Local Hook"
7. Should render > 0 views
8. Compare outputs in status log

### Test 2: Hook State
Test hooks that use useState:
```jsx
export default function Counter() {
  const [count, setCount] = useState(0);
  return <div>Count: {count}</div>;
}
```
- Both Act and React Native should handle state
- React Native logs will show hook initialization

### Test 3: Effects
Test hooks with useEffect:
```jsx
export default function Timer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return <div>Time: {seconds}s</div>;
}
```
- React Native should execute the effect
- Cleanup should run on unmount

## Troubleshooting

### "Render returned null result"
- Check that test hook has `export default`
- Check hook file is in assets directory
- Check syntax errors in JSX

### "Bridge not found!"
- Restart app
- Check logcat for bridge initialization errors
- Verify `installBridge()` was called

### No native views created
- Check bridge call count in logs
- If 0 calls → renderer not invoking bridge
- If > 0 calls but no views → NativeRenderer issue

### App crash
- Check logcat for full stack trace
- React Native errors are logged before placeholder
- Look for "Module Error" in logs

## Success Metrics

✅ React Native successfully added if:
- [x] Bundle loads without errors
- [x] Renderer.render() is callable
- [x] Bridge is invoked for view creation
- [x] Native views appear in output
- [x] UI toggle switches renderers
- [x] Build succeeds without errors

## Next Steps

Once you have both renderers working:

1. **Compare Act vs React Native output** with test-hook.jsx
   - Which creates more views?
   - Which has more bridge calls?
   - Which produces correct layout?

2. **If React Native works but Act doesn't:**
   - Issue is Act-specific
   - May need to fix Act bundle or integration

3. **If both fail identically:**
   - Issue is likely in transpilation
   - Check SWC helpers availability
   - Review module loading logic

4. **Use React Native as fallback:**
   - Can ship React Native if Act is broken
   - Same codebase, just different backend
   - Users won't notice the difference

## Full Documentation

See [REACT_NATIVE_IMPLEMENTATION.md](./REACT_NATIVE_IMPLEMENTATION.md) for detailed implementation notes.
