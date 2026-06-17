# Clash of Crowns: Capacitor Immersive Fullscreen Integration Report

This document records the architectural and UI styling changes applied to achieve true edge-to-edge full-bleed immersive landscape rendering on Android devices, specifically fixing layout cutoffs, notification/navigation bar overlays, and safe-area notch padding.

---

## 1. System-Level UI Hiding (Java)

**File modified:** [MainActivity.java](file:///c:/Users/tripu/OneDrive/Desktop/clash-of-crowns/android/app/src/main/java/com/clashofcrowns/game/MainActivity.java)

To prevent the Android OS status bar and navigation pill from showing up during game play (even when swiping/interacting), we overrode the main activity lifecycle to set the system UI flags dynamically:

* **Immersive Sticky Flag**: Enforces system bars to stay hidden. If the user swipes from the edge to check notifications, the status bar fades in temporarily as a semi-transparent overlay and automatically auto-hides after 2 seconds without shifting the web view.
* **Layout Stable & Fullscreen Flags**: Directs the system to lay out the app's web view as if the system bars are already hidden, preventing layout resizing/jitter when system bars toggle.

```java
package com.clashofcrowns.game;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUI();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    private void hideSystemUI() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }
}
```

---

## 2. Window Layout Display Cutout (styles.xml)

**File modified:** [styles.xml](file:///c:/Users/tripu/OneDrive/Desktop/clash-of-crowns/android/app/src/main/res/values/styles.xml)

By default, Android letterboxes WebViews in landscape mode to avoid rendering under the camera notch. To force the game canvas to draw in the notch area (full bleed):

* Configured the theme `AppTheme.NoActionBar` with `android:windowLayoutInDisplayCutoutMode` set to `shortEdges`.
* Set status/navigation bar background colors to transparent to prevent solid bands.

```xml
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/black</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
```

---

## 3. Capacitor Bridge Setup (React Initialization)

**File modified:** [App.tsx](file:///c:/Users/tripu/OneDrive/Desktop/clash-of-crowns/src/App.tsx)

Installed and synchronized the `@capacitor/status-bar` plugin. Added an initialization hook inside the root `App` component that programmatically hides the status bar overlay on native startup:

```typescript
import { StatusBar } from '@capacitor/status-bar';

// ...

// Hide StatusBar on native platform
useEffect(() => {
  const setupMobileFullscreen = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await StatusBar.hide();
      } catch (err) {
        console.warn('Failed to hide status bar:', err);
      }
    }
  };
  setupMobileFullscreen();
}, []);
```

---

## 4. Scrollbar and Viewport Height Locks (CSS)

**File modified:** [index.css](file:///c:/Users/tripu/OneDrive/Desktop/clash-of-crowns/src/index.css)

Locked the dimensions of `html`, `body`, and the React root container `#root` to prevent layout scrolling, shifting, or horizontal bounces on viewport changes.

```css
  html, body, #root {
    background-color: #030204 !important;
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    min-width: 100%;
    min-height: 100%;
    overflow: hidden;
  }
```

---

## 5. Responsive Grid & Safe Area Padding on Login Screen

**File modified:** [LoginScreen.tsx](file:///c:/Users/tripu/OneDrive/Desktop/clash-of-crowns/src/components/screens/LoginScreen.tsx)

* **Grid Splitting**: Refactored the login layout to use Tailwind CSS `landscape:grid-cols-[minmax(280px,0.85fr)_minmax(360px,1.15fr)]` dynamically splitting the branding (left column) and interaction buttons (right column) side-by-side on wide/landscape viewports. This prevents vertical cutoffs on mobile aspect ratios.
* **Notch Handling**: Inset interactive UI content from screen edges using CSS environment variables (`env(safe-area-inset-left)` / `env(safe-area-inset-right)`) while keeping absolute background elements full bleed.

```typescript
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#030204] relative overflow-hidden p-4 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-8">
      {/* Background Elements (absolute inset-0) draw full bleed under notch */}
      ...
```

---

## Verification Status
* **Web Build**: Successfully compiled via Vite/esbuild.
* **Capacitor Sync**: Completed, plugins verified (`@capacitor/status-bar` and `@capacitor/app` registered).
* **APK Build & Install**: Done successfully via Gradle using the compatible JBR runtime JDK 21.
