# Merge notes — `src/` field-sales app → Salesforce Mobile SDK RN shell

The application source that lived in `../src/` (a WatermelonDB-backed, Redux
offline field‑sales app) has been merged into this Salesforce Mobile SDK React
Native project (`forcereact`, MSDK v13.2.1, RN 0.81, React 19, Android only).

No APK was built. This document lists everything that changed and the few
things **you** must supply before the app will build/run.

**Verified:** `yarn install` succeeds, and a full release Metro bundle
(`npx react-native bundle --platform android --dev false --entry-file index.js`)
compiles the entire `src/` graph + all deps into a 6.6 MB bundle with **zero
unresolved modules** — decorators, the SVG transformer and the `config.js` stub
all resolve.

**Firebase / Google Maps removed as blockers** (see items 4–5 of *YOU MUST DO*):
Firebase is now a set of local no-op modules, so `google-services.json` is no
longer required to build. Maps stays in the build and renders blank without a key.

**APK build status:** the Android native compile completed once
(`assembleRelease`, ~3 h on this machine). The release JS-bundle step
(`createBundleReleaseJsAndAssets`) is extremely slow here because Metro has no
Watchman on Windows and re-crawls the large `node_modules` on every cold start —
budget 30–60 min for it, and **do not interrupt it**. To finish the APK:

```
cd SalesforceMobileApp/android
./gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
```

Output: `android/app/build/outputs/apk/release/app-release.apk` (debug-keystore
signed → installs on a device). Speed it up massively by installing Watchman, or
run `npx react-native start` once first to warm Metro's cache.

---

## What was changed

### JS / entry
| File | Change |
|---|---|
| `src/` | Whole tree copied in from `../src` (472 files, `.DS_Store` stripped). |
| `config.js` | **New STUB at project root.** `src/` imports a root-level `../config` (7 named exports) that was not in the handed-over `src/` folder — see item 1 of **YOU MUST DO**. |
| `node_modules/@react-native-firebase/{app,messaging,crashlytics,remote-config}` | **Local no-op modules** (source in `shims/firebase-*.js`). Not in `package.json`, no native code → RN autolinking ignores them. Every Firebase call is a safe no-op. Delete these dirs and re-add the real `@react-native-firebase/*` deps + `google-services.json` + the `com.google.gms.google-services` plugin (2 gradle files) to turn Firebase back on. |
| `src/redux/store.js` → `store.ts` | Renamed — it declares TS types (`export type RootState = …`). All imports are extension-less so nothing else changed. |
| `src/screens/dashboards/DashboardWorkingSummary.tsx` | Fixed a filename typo in one import (`DashboardWorkingSummaray.js` → `DashboardWorkingSummary.js`). Screen is currently unreferenced. |
| `App.tsx` | **New root.** Wraps `src/navigation/MainNavigator` with `redux` `<Provider>` + `redux-persist` `<PersistGate>` (`src/redux/store`), `GestureHandlerRootView`, `SafeAreaProvider`, `PaperProvider`. |
| `app.tsx` (old sample) | Deleted — replaced by `App.tsx`. |
| `index.js` | Registers `./App` under the `app.json` name; imports `react-native-gesture-handler` first; registers a guarded FCM `setBackgroundMessageHandler`. |
| `babel.config.js` | Added `@babel/plugin-proposal-decorators` (`legacy: true`) — required by WatermelonDB model decorators. |
| `metro.config.js` | Added `react-native-svg-transformer` (SVGs in `src/` are imported as components) — `svg` moved from `assetExts` to `sourceExts`. |
| `svg.d.ts` | New — TS module declaration for `*.svg`. |
| `package.json` | Added ~45 runtime deps + `react-native-svg-transformer` & the babel decorators plugin (dev). See list below. |
| `src/utils/sync/syncData.js` | Fixed a broken placeholder import (`./path-to-your-hook/useApiFetch` → `../apiFetchHooks/useApiFetch`). File is currently unused. |

### Android native
| File | Change |
|---|---|
| `android/build.gradle` | Added `com.google.gms:google-services:4.4.2` classpath. |
| `android/app/build.gradle` | Apply `com.google.gms.google-services`; apply legacy `react-native-vector-icons/fonts.gradle`; `packagingOptions.jniLibs.pickFirsts` for `libc++_shared.so` / `libfbjni.so`; `manifestPlaceholders.GOOGLE_MAPS_API_KEY` from a Gradle property. |
| `android/gradle.properties` | Added empty `GOOGLE_MAPS_API_KEY=`. |
| `AndroidManifest.xml` | Added permissions (location, camera, notifications, network state, media/storage), `uses-feature` (camera/gps `required=false`), and the `com.google.android.geo.API_KEY` meta-data. |
| `MainActivity.kt` | `shouldAuthenticate()` changed `true → false` — see **Auth model** below. |
| `.gitignore` | Ignore `android/app/google-services.json` and `ios/GoogleService-Info.plist`; keep the `.template`. |
| `android/app/google-services.json.template` | New placeholder — copy to `google-services.json` with real values. |

Everything else (native module linking for maps, camera, svg, firebase, vector
icons, permissions, netinfo, device-info, fs, image-picker, linear-gradient,
webview, etc.) is handled by **React Native autolinking** — no manual
`MainApplication` edits needed.

---

## YOU MUST DO before building

1. **Replace `config.js` (project root) with your real one.** `src/` imports it
   as `../config` / `../../config` / `../../../config` from 27 files; it was a
   root-level module in your original project and was not included in the `src/`
   folder handed over. The generated stub exports the 7 required symbols
   (`CLEAR_TABLES`, `CLEAR_TABLES_GET_DATA`, `loadDynamicConfig`, `PlaceId_var`,
   `PriceBookId_var`, `OrderRecordTypeId_var`, `ReturnRecordTypeId_var`) with
   empty/no-op values so the bundle builds — but orders will be created without a
   Pricebook/RecordType and Places search won't work until you paste the real
   file (or fill in the values). Salesforce Ids are org-specific.

2. **iOS: nothing to do.** There is no `ios/` folder — this project was generated
   Android‑only. (Add iOS later with `forcereact create --platform=ios …` or by
   adding the platform; then Podfile / Info.plist / react-native-permissions
   setup is required.)

4. **Firebase — nothing required to build.** It's been replaced by local no-op
   modules, so `google-services.json` is *not*
   needed and the `com.google.gms.google-services` plugin has been removed from
   both gradle files. FCM push, Crashlytics and Remote Config are inert until you
   wire real Firebase back in. To do that: delete
   `node_modules/@react-native-firebase/{app,messaging,crashlytics,remote-config}`,
   re-add those 4 deps to `package.json` (`^22.4.0`), re-add
   `classpath("com.google.gms:google-services:4.4.2")` to `android/build.gradle`
   and `apply plugin: "com.google.gms.google-services"` to `android/app/build.gradle`,
   and drop your real `google-services.json` into `android/app/`.

5. **Google Maps API key (optional)** — put your Android Maps SDK key in
   `android/gradle.properties` → `GOOGLE_MAPS_API_KEY=...` (or your
   `~/.gradle/gradle.properties`). The build works without it; map views just
   render blank. No other screen is affected.

6. **Salesforce OAuth** — already configured from the original scaffold:
   - `android/app/src/main/res/values/bootconfig.xml` — Consumer Key +
     `com.example.salesforcemobileapp://oauth/callback`
   - `android/app/src/main/res/xml/servers.xml` — `https://test.salesforce.com`
   Confirm these match your External Client App.

7. **JDK 17** — pinned in `android/gradle.properties`
   (`org.gradle.java.home=C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot`).
   Adjust if your JDK 17 path differs.

---

## Auth model (important)

`src/utils/helper/StartupCoordinator.tsx` runs the login itself: it calls the
Mobile SDK's `oauth.getAuthCredentials()` / `oauth.authenticate()` (from
`react-native-force`), then hydrates Redux (`authSlice.loginSuccess`) with the
resulting `accessToken` / `instanceUrl` / `refreshToken` / `userId`, wrapped in
its own migration + device-validation + sync-progress UI. All data sync
(`src/UtilityMain/**`, `src/utils/apiFetchHooks/useApiFetch.js`) then uses those
Redux tokens against the Salesforce REST API.

Because the JS layer owns the flow, `MainActivity.shouldAuthenticate()` is set to
**`false`** so `SalesforceReactActivity` does **not** show its own native login
gate before React mounts. Set it back to `true` if you'd rather the native MSDK
login screen gate the app first (StartupCoordinator's `getAuthCredentials` would
then just succeed immediately).

`useApiFetch.js` also does its own `grant_type=refresh_token` call to
`https://login.salesforce.com/services/oauth2/token` on 401. If your org logs in
via `test.salesforce.com` you may want that URL made environment-aware.

---

## Dependency versions — verify against your original project

`../src` arrived without a `package.json`, so the versions below were chosen for
RN 0.81 / React 19 compatibility. If you have the original app's `package.json`,
diff it and pin to the versions you actually shipped.

Runtime deps added: `@nozbe/watermelondb`, `@react-native-async-storage/async-storage`,
`@react-native-community/netinfo`, `@react-native-firebase/{app,crashlytics,messaging,remote-config}`,
`@react-native-vector-icons/{common,entypo,feather,fontawesome,fontawesome5,material-design-icons,material-icons,simple-line-icons}`,
`@reduxjs/toolkit`, `axios`, `d3-shape`, `formik`, `moment`, `number-to-words`,
`react-native-date-picker`, `react-native-device-info`, `react-native-element-dropdown`,
`react-native-fs`, `react-native-geolocation-service`, `react-native-image-picker`,
`react-native-image-resizer`, `react-native-keyboard-aware-scroll-view`,
`react-native-linear-gradient`, `react-native-maps`, `react-native-modern-datepicker`,
`react-native-paper`, `react-native-permissions`, `react-native-phone-call`,
`react-native-print`, `react-native-responsive-fontsize`, `react-native-responsive-screen`,
`react-native-size-matters`, `react-native-spinkit`, `react-native-svg`,
`react-native-svg-charts`, `react-native-uuid`, `react-native-vector-icons` (v10, for
`Ionicons`), `react-native-vision-camera`, `react-native-walkthrough-tooltip`,
`react-native-webview`, `react-redux`, `redux-persist`.

### Known-fragile picks
- **`react-native-image-resizer`** — the code imports the legacy package name.
  It is unmaintained; if the Android build chokes on it, switch to
  `@bam.tech/react-native-image-resizer` and either update the imports or add a
  Metro `resolver.alias`.
- **`react-native-svg-charts` (v5)** / **`react-native-spinkit`** /
  **`react-native-modern-datepicker`** — old, declare stale peer deps. `yarn`
  installs them with warnings; watch for runtime issues with the new
  `react-native-svg` major.
- **`@react-native-vector-icons/*` v12 (scoped)** vs **`react-native-vector-icons`
  v10 (legacy, `Ionicons` only)** — both are installed because `src/` imports
  from both. Fonts: scoped packages self‑register via autolinking; the legacy one
  is handled by the `fonts.gradle` line added to `android/app/build.gradle`.

---

## Suggested verification (no APK)

```bash
cd SalesforceMobileApp
yarn install
npx tsc --noEmit                       # type-check src/ (expect pre-existing errors)
npx react-native bundle --platform android --dev false \
  --entry-file index.js --bundle-output /tmp/check.android.bundle \
  --assets-dest /tmp/check-assets       # proves the JS graph resolves
```

Then, when Firebase + Maps key are in place:

```bash
cd android && ./gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a
```

---

## Not touched / your call

- App display name / icon / applicationId are still the scaffold defaults
  (`SalesforceMobileApp`, `com.example.salesforcemobileapp`). `src/` refers to
  "Kaleshwari"/"Emami" branding and a WatermelonDB `dbName: 'emami-local-db'` —
  rename if you want consistency.
- `src/` still contains many `*_old*.tsx` / `* copy.tsx` duplicate files from the
  original working tree. They were merged verbatim; delete at will.
- ProGuard/R8 is off for release. Turn on before shipping and add keep rules for
  WatermelonDB / Firebase / vector-icons as needed.

---

## AABL brand theme (applied)

Retheme from the original red/white to **Associated Alcohols & Breweries**
(associatedalcohols.com) — premium spirits: near-black + gold, white wordmark.

| Area | Change |
|---|---|
| Palette | `#ac0d05`→`#C89930` (gold), `#9b0b22`→`#A47100` (deep gold), pink washes→pale gold, `rgba(200,16,46,*)` shadow→gold. Secondary `#12344D`→`#1A1A1A` (ink text), `#2355B8`/`#162959`→`#C89930`. ~1050 replacements across ~165 files (hex only — semantic error-reds like `#c8102e`, `#b91c1c` intentionally kept). |
| `src/theme.ts` | Rewritten as the AABL palette (same keys kept for compat, added `ink*` / `textOnDark`). |
| Main header (`components/Header.tsx`, `assets/css/Header.js`) | Now a near-black bar (`#0D0D0D`) with a 1px gold underline; the white AABL wordmark and gold icons sit on it. |
| Logo | `aabl-logo-1.png` (white, 214×55) decoded + upscaled 4× → `src/assets/images/aabl-logo.png` (856×220), and written over the app's existing `Emami1.png` / `emamiLogo.png` / `emami.png` so every reference updates. `aabl-logo-dark.png` also generated for light backgrounds. |
| Launcher icon | `android/app/src/main/res/mipmap-*/ic_launcher.png` + `ic_launcher_round.png` regenerated (mdpi→xxxhdpi): gold geometric "A" monogram + gold ring on `#0D0D0D`. Manifest now points at `@mipmap/ic_launcher` / `@mipmap/ic_launcher_round` (was `@drawable/sf__icon`, the Salesforce cloud). |
| Splash / launch | New `AABLLaunchTheme` (`values/styles.xml`) — dark `#0D0D0D` window + status/nav bar + Android-12 splash background; `MainActivity` uses it (was `Theme.AppCompat.Light.NoActionBar`, a white flash). New `values/colors.xml` with `aabl_ink` / `aabl_gold`. |
| App name | `values/strings.xml` `app_name` → **AABL** (was `SalesforceMobileApp`). JS component name unchanged. |

Regeneration script: `scripts/brand-assets.js` (`node scripts/brand-assets.js`) — pure-Node PNG codec, re-run it if you swap in a different logo file.
