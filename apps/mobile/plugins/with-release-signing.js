const { withAppBuildGradle } = require("expo/config-plugins");

// Signs release builds with the Google Play upload key named in ~/.gradle/gradle.properties, so
// the key and its passwords stay out of the repository. Without it, release builds keep using
// the debug key, which Google Play rejects.
const PROPERTY = "RAILRADAR_UPLOAD_STORE_FILE";

const debugSigningConfig = `            keyPassword 'android'
        }
`;
const releaseSigningConfig = `        if (findProperty('${PROPERTY}')) {
            release {
                storeFile file(findProperty('${PROPERTY}'))
                storePassword findProperty('RAILRADAR_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('RAILRADAR_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('RAILRADAR_UPLOAD_KEY_PASSWORD')
            }
        }
`;
const releaseBuildType = `            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (gradle.includes(PROPERTY)) return config;
    if (!gradle.includes(debugSigningConfig) || !gradle.includes(releaseBuildType)) {
      // Better than a release build that is quietly signed with the debug key.
      throw new Error("with-release-signing: the Expo template's signing config has changed");
    }
    gradle = gradle.replace(debugSigningConfig, debugSigningConfig + releaseSigningConfig);
    gradle = gradle.replace(
      releaseBuildType,
      releaseBuildType.replace(
        "signingConfigs.debug",
        "signingConfigs.findByName('release') ?: signingConfigs.debug",
      ),
    );
    config.modResults.contents = gradle;
    return config;
  });
}

module.exports = withReleaseSigning;
