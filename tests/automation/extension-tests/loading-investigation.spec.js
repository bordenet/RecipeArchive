/* eslint-disable no-unused-vars */
const { test, expect, chromium } = require("@playwright/test");
const path = require("path");

test.describe("Extension Loading Investigation", () => {
  test("Investigate why extension is not loading", async () => {
    console.log("🔍 Investigating extension loading...");

    const extensionPath = path.resolve(__dirname, "../../../extensions/chrome");
    console.log("📁 Extension path:", extensionPath);

    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        "--disable-extensions-except=" + extensionPath,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-default-apps",
        "--enable-logging",
        "--v=1",
      ],
    });

    try {
      console.log("✅ Context created with extension loading args");

      // Wait for extension to load
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const backgroundPages = context.backgroundPages();
      console.log("🔧 Background pages:", backgroundPages.length);

      // Navigate to extensions page
      const page = await context.newPage();
      await page.goto("chrome://extensions/");
      console.log("📄 Extensions page loaded");

      // Enable developer mode
      try {
        const devModeToggle = page.locator("#devMode");
        const isVisible = await devModeToggle.isVisible();
        console.log("🔧 Developer mode toggle visible:", isVisible);

        if (isVisible) {
          const isChecked = await devModeToggle.isChecked();
          console.log("🔧 Developer mode checked:", isChecked);

          if (!isChecked) {
            await devModeToggle.click();
            await page.waitForTimeout(1000);
            console.log("✅ Developer mode enabled");
          }
        }
      } catch (error) {
        console.log("⚠️ Developer mode toggle error:", error.message);
      }

      // Look for extensions
      const extensionItems = await page.locator("extensions-item").count();
      console.log("📦 Extension items found:", extensionItems);

      if (extensionItems > 0) {
        for (let i = 0; i < extensionItems; i++) {
          const item = page.locator("extensions-item").nth(i);
          try {
            const name = await item.locator(".name").textContent();
            const id = await item.getAttribute("id");
            console.log(`📦 Extension ${i + 1}: ${name} (ID: ${id})`);

            // Check for errors
            const errorSection = item.locator(".error-message, .section.error");
            const errorCount = await errorSection.count();
            if (errorCount > 0) {
              console.log(`❌ Extension ${i + 1} has ${errorCount} errors:`);
              for (let j = 0; j < errorCount; j++) {
                const errorText = await errorSection.nth(j).textContent();
                console.log(`  📝 Error ${j + 1}: ${errorText}`);
              }
            }

            // Check if it's enabled
            const toggles = await item.locator("cr-toggle").count();
            if (toggles > 0) {
              const isEnabled = await item
                .locator("cr-toggle")
                .first()
                .isChecked();
              console.log(`🔘 Extension ${i + 1} enabled: ${isEnabled}`);
            }
          } catch (error) {
            console.log(`⚠️ Error reading extension ${i + 1}:`, error.message);
          }
        }
      } else {
        console.log("❌ No extensions found on the page");

        // Let's check if there are any error messages on the page
        const allText = await page.textContent("body");
        console.log(
          "📄 Extensions page content preview:",
          allText.substring(0, 500)
        );

        // Check for specific error indicators
        const errorElements = await page
          .locator("[role=\"alert\"], .error, .warning")
          .count();
        console.log("⚠️ Error elements on page:", errorElements);

        if (errorElements > 0) {
          for (let i = 0; i < errorElements; i++) {
            const errorText = await page
              .locator("[role=\"alert\"], .error, .warning")
              .nth(i)
              .textContent();
            console.log(`❌ Error ${i + 1}: ${errorText}`);
          }
        }
      }

      // Take a detailed screenshot
      await page.screenshot({
        path: "extension-investigation.png",
        fullPage: true,
      });
      console.log("📸 Full investigation screenshot saved");

      await page.close();
    } finally {
      await context.close();
      console.log("✅ Extension loading investigation complete");
    }
  });
});
