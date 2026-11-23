const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Locking the app to portrait ("orientation" in app.json) makes Google Play infer that it needs a
 * portrait screen, android.hardware.screen.portrait, and hide it from tablets, desktops and XR
 * devices that do not report one. Declaring the feature optional keeps the lock and the devices:
 * the app still opens in portrait wherever it can.
 */
const OPTIONAL_FEATURES = ['android.hardware.screen.portrait'];

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] ?? [];
    for (const name of OPTIONAL_FEATURES) {
      const declared = manifest['uses-feature'].find((f) => f.$?.['android:name'] === name);
      if (declared) declared.$['android:required'] = 'false';
      else manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return mod;
  });
};
