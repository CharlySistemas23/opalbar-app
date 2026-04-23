// Polyfill: Fix "Cannot assign to property 'protocol' which has only a getter"
(function patchURL() {
  if (typeof URL === 'undefined') return;
  const descriptor = Object.getOwnPropertyDescriptor(URL.prototype, 'protocol');
  if (descriptor && !descriptor.set) {
    Object.defineProperty(URL.prototype, 'protocol', {
      configurable: true,
      enumerable: true,
      get: descriptor.get,
      set: function () {},
    });
  }
})();

// Disable react-native-screens native implementation to avoid
// "expected dynamic type 'boolean', but had type 'string'" error
// that occurs with RNSScreen on iOS when using expo-router v6 + RN 0.81.
import { enableScreens } from 'react-native-screens';
enableScreens(false);

import 'expo-router/entry';
