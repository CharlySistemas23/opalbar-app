module.exports = function (api) {
  api.cache(true);
  // Ensure expo-router can locate the app directory in the monorepo context
  if (!process.env.EXPO_ROUTER_APP_ROOT) {
    process.env.EXPO_ROUTER_APP_ROOT = 'app';
  }
  return {
    presets: ['babel-preset-expo'],
  };
};
