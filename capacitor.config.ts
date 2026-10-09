import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.stardustcrusaders.borrowedtime",
  appName: "Borrowed Time",
  webDir: "dist",
  backgroundColor: "#5e9a98",
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: {
      // The scene hides the splash itself once it is ready (startup is measured to that point).
      launchAutoHide: false,
      backgroundColor: "#efe6d2",
    },
  },
};

export default config;
