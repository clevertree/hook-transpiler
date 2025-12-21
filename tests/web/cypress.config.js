import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8083',
    setupNodeEvents(on, config) {
      on('task', {
        log(message) {
          console.log(message)
          return null
        }
      })
    },
    supportFile: false,
    video: false,
    screenshotOnRunFailure: false,
    chromeWebSecurity: false
  },
});
