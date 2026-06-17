# How to Run in Android Studio

I have pre-configured this project to work with **Android Studio**. Follow these exact steps to get the app on your phone:

### 1. Export the Project
1. Click **Settings** (gear icon) -> **Export to ZIP**.
2. Extract the ZIP file on your computer.

### 2. Prepare the Android Folder
Open a terminal (Command Prompt) in the extracted folder and run:
```bash
# 1. Install dependencies
npm install

# 2. Build the game (I have updated the config to fix the black screen)
npm run build

# 3. Create the Android project folder
npx cap add android

# 4. Sync the built files to Android
npx cap sync
```

### 3. Open in Android Studio
1. Open **Android Studio**.
2. Click **Open** and select the folder named **`android`** inside your project.
3. Wait for the "Gradle Sync" to finish (it happens automatically at the bottom).

### 4. Run on your Phone
1. Connect your phone via USB (ensure USB Debugging is ON).
2. In Android Studio, look at the top bar. You should see your phone's name.
3. Click the **Green Play Button** (Run 'app').

---

## OPTION 2: PURE NATIVE ANDROID (No Capacitor)
If you want a separate, independent Android Studio project without any Capacitor dependency, I have created one for you in the **`AndroidNativeApp`** folder.

### 1. Build and Sync
**CRITICAL**: You must be in the **ROOT** folder (e.g., `clash-of-crowns (3)`), NOT inside the `AndroidNativeApp` folder.

Open a terminal in the **ROOT** folder and run:
```bash
# 1. Install the build tools (only need to do this once)
npm install

# 2. Build and copy the game to Android
npm run build:native
```
*This will build the game and copy all files into the Android project's assets perfectly.*

### 2. Open in Android Studio
1. Open **Android Studio**.
2. Click **Open** and select the folder named **`AndroidNativeApp`**.
3. Wait for the Gradle build to finish.

### 3. Run
Connect your phone and click the **Green Play Button**. This is a pure Kotlin Android app that loads your game locally.

**That's it! The app will install on your phone and look exactly like the web version.**
