# Sanadak mobile app (iOS and Android)

React Native (Expo SDK 58, Expo Router) client for the same backend as the website. Same design tokens, Arabic first with RTL, English, light and dark.

## What it covers

- Welcome page: hero ask box, use-case cards, features, comparison, how it works, plans from `/billing/plans`, privacy, FAQ, footer.
- Account: sign in, sign up, email verification, forgot and reset password. Tokens live in the secure keychain/keystore.
- Chat: streamed answers with Markdown, sources opened in a sheet, conversation history with search, rename and delete, usage meters and limits, attachments (files, library photos, camera, long pasted text becomes `pasted-text-N.txt`), defence memo, contract review, catalogue documents and the contract wizard, Word files shared through the system share sheet.
- Profile: account details, plan, usage breakdown. Billing: plans, top-ups, payment history, Paymob checkout in the system browser, then the app reads the payment status from the backend.

## Run

```bash
npm install --legacy-peer-deps
npx expo start            # Expo Go works for everything except nothing native-only here
npx expo run:android      # or: npx expo run:ios (macOS), for a development build
```

Environment (optional, defaults point at the production servers):

- `EXPO_PUBLIC_API_URL` backend API base, default `http://41.187.93.60:34000/api`
- `EXPO_PUBLIC_SITE_URL` site origin, default `http://41.187.93.60:34777`

## Checks

```bash
npm run typecheck
npm test
npm run lint
npx expo export --platform android --platform ios   # bundle check
```

## Notes

- The backend is plain HTTP, so Android cleartext traffic and an iOS ATS exception for `41.187.93.60` are enabled in `app.json`. Put the API behind HTTPS and remove both before a store release.
- Changing the language reloads the app, because React Native fixes the text direction at start.
- `assets/icon.png`, `splash-icon.png` and the Android adaptive icon are still the Expo placeholders. Replace them with 1024 px brand art.
- Store builds: `npx eas build -p android` / `-p ios` after `eas build:configure`.
