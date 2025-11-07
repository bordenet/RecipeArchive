const { chromium } = require("@playwright/test");
const path = require("path");

async function testExtensionDirectly() {
  const EXTENSION_PATH = path.resolve(__dirname, "../../../extensions/chrome");

  console.log("🚀 Testing Chrome Extension Loading Directly");
  console.log("📁 Extension path:", EXTENSION_PATH);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 2000,
    args: [
      `--load-extension=${EXTENSION_PATH}`,
      "--disable-extensions-except=" + EXTENSION_PATH,
      "--no-first-run",
      "--disable-default-apps",
      "--disable-web-security",
      "--enable-logging=stderr",
      "--log-level=0",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Give Chrome time to load extension
  console.log("⏱️ Waiting for extension to load...");
  await page.waitForTimeout(5000);

  // Check background pages/service workers
  const backgroundPages = context.backgroundPages();
  console.log("🔧 Background pages count:", backgroundPages.length);

  if (backgroundPages.length === 0) {
    console.log("❌ No background pages found - checking extension management");

    try {
      // Go to chrome://extensions/
      await page.goto("chrome://extensions/");
      await page.waitForTimeout(3000);

      // Take a screenshot for debugging
      await page.screenshot({
        path: path.join(__dirname, "extension-debug-screenshot.png"),
        fullPage: true,
      });
      console.log("📸 Extension debug screenshot saved");

      // Try to enable developer mode
      const devModeButton = page.locator(
        "cr-toggle[aria-label=\"Developer mode\"]"
      );
      if (await devModeButton.isVisible()) {
        console.log("🔧 Enabling developer mode...");
        await devModeButton.click();
        await page.waitForTimeout(2000);
      }

      // Check if our extension appears
      const extensionCards = await page.locator("extensions-item").count();
      console.log("📦 Extensions found:", extensionCards);

      if (extensionCards === 0) {
        console.log("❌ No extensions visible - checking page content");
        const pageContent = await page.textContent("body");
        console.log(
          "📄 Page contains RecipeArchive:",
          pageContent.includes("RecipeArchive")
        );

        // Try loading the extension manually
        console.log("🔄 Trying to load extension manually...");
        const loadUnpackedButton = page.locator(
          "cr-button:has-text(\"Load unpacked\")"
        );
        if (await loadUnpackedButton.isVisible()) {
          console.log("✅ Found \"Load unpacked\" button");
          // Note: We can't actually click this and select a directory in automated tests
          // but we can confirm the button is there
        }
      } else {
        console.log("✅ Extensions are visible, checking details...");
        for (let i = 0; i < extensionCards; i++) {
          const card = page.locator("extensions-item").nth(i);
          const nameElement = card.locator("#name");
          if (await nameElement.isVisible()) {
            const name = await nameElement.textContent();
            console.log(`📦 Extension ${i + 1}: "${name}"`);

            if (name.includes("RecipeArchive")) {
              console.log("✅ Found RecipeArchive extension!");

              // Check if it's enabled
              const toggleElement = card.locator("cr-toggle");
              if (await toggleElement.isVisible()) {
                const isEnabled = await toggleElement.evaluate(
                  (el) => el.checked
                );
                console.log("🔧 Extension enabled:", isEnabled);

                if (!isEnabled) {
                  console.log("🔄 Enabling extension...");
                  await toggleElement.click();
                  await page.waitForTimeout(2000);
                }
              }

              // Check for errors
              const errorSection = card.locator(
                ".error-message, #errors-section"
              );
              if (await errorSection.isVisible()) {
                const errorText = await errorSection.textContent();
                console.log("❌ Extension error:", errorText);
              } else {
                console.log("✅ No visible errors");
              }
            }
          }
        }
      }
    } catch (error) {
      console.log("❌ Error accessing chrome://extensions/:", error.message);
    }
  } else {
    console.log("✅ Background pages found:");
    backgroundPages.forEach((bg, i) => {
      console.log(`  ${i + 1}. ${bg.url()}`);
    });
  }

  // Test if we can navigate to our test page
  console.log("🌐 Testing navigation to mock server...");
  try {
    await page.goto("http://localhost:8080/test-page");
    await page.waitForTimeout(3000);

    const title = await page.title();
    console.log("📄 Test page title:", title);

    // Check if content script is working
    const contentScriptTest = await page.evaluate(() => {
      console.log("🧪 Testing content script from browser console...");
      return {
        chromeRuntime:
          typeof chrome !== "undefined" &&
          typeof chrome.runtime !== "undefined",
        windowLocation: window.location.href,
        documentTitle: document.title,
      };
    });

    console.log("🔧 Content script test results:", contentScriptTest);
  } catch (error) {
    console.log("❌ Error testing page navigation:", error.message);
  }

  console.log("🏁 Test complete");

  await browser.close();
}

// Run the test
testExtensionDirectly().catch(console.error);
