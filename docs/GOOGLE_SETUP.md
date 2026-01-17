# Google Sign-In Setup Guide

To enable Google Sign-In for Fitzo, you need to create OAuth credentials in the Google Cloud Console.

## 1. OAuth Consent Screen
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Select your project (or create a new one).
3.  In the left sidebar (hamburger menu), go to **APIs & Services** > **OAuth consent screen**.
4.  Select **External** (unless you are a Google Workspace user).
5.  Click **Create**.
6.  **App Information**:
    *   **App name**: Fitzo
    *   **User support email**: Your email
    *   **Developer contact information**: Your email
7.  Click **Save and Continue** through the "Scopes" and "Test Users" sections (you can add yourself as a test user).

## 2. Create Credentials (Client IDs)

You need to create separate Client IDs for each platform.

Go to **APIs & Services** > **Credentials**.

### A. Android Client ID
1.  Click **+ CREATE CREDENTIALS** > **OAuth client ID**.
2.  **Application type**: Android.
3.  **Name**: Fitzo Android.
4.  **Package name**: `com.fitzo.app` (This matches `app.json`).
5.  **SHA-1 certificate fingerprint**:
    *   Run `npx expo credentials:manager` in your terminal to view/generate your SHA-1.
    *   OR for local development keystore: `keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android`
6.  Click **Create**. Copy the **Client ID**.

### B. iOS Client ID
1.  Click **+ CREATE CREDENTIALS** > **OAuth client ID**.
2.  **Application type**: iOS.
3.  **Name**: Fitzo iOS.
4.  **Bundle ID**: `com.fitzo.app`.
5.  Click **Create**. Copy the **Client ID**.

### C. Web Client ID (For Expo Go)
1.  Click **+ CREATE CREDENTIALS** > **OAuth client ID**.
2.  **Application type**: Web application.
3.  **Name**: Fitzo Web (Expo).
4.  **Authorized JavaScript origins**: `https://auth.expo.io`
5.  **Authorized redirect URIs**: `https://auth.expo.io/@your-username/fitzo`
6.  Click **Create**. Copy the **Client ID**.

## 3. Usage
Add these Client IDs to your `.env` or `app.json` configuration, or pass them directly to `Google.useAuthRequest` in the code.
