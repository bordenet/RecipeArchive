//
//  SafariWebExtensionHandler.swift
//  RecipeExtension
//
//  Handles communication between Safari Web Extension and native app
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private let logger = Logger(subsystem: "com.recipearchive.RecipeExtension", category: "Handler")

    func beginRequest(with context: NSExtensionContext) {
        logger.log("Safari Web Extension request received")

        // Handle native messaging from JavaScript
        let request = context.inputItems.first as? NSExtensionItem

        guard let message = request?.userInfo?[SFExtensionMessageKey] as? [String: Any] else {
            logger.error("No message found in request")
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }

        logger.log("Received message: \(String(describing: message))")

        // Handle different message types
        if let action = message["action"] as? String {
            switch action {
            case "saveRecipe":
                handleSaveRecipe(message: message, context: context)
            case "getAppGroupData":
                handleGetAppGroupData(context: context)
            default:
                logger.warning("Unknown action: \(action)")
                respondWithError(context: context, error: "Unknown action")
            }
        } else {
            respondWithError(context: context, error: "No action specified")
        }
    }

    // Handle saving recipe to App Group
    private func handleSaveRecipe(message: [String: Any], context: NSExtensionContext) {
        guard let url = message["url"] as? String,
              let html = message["html"] as? String else {
            logger.error("Missing required fields: url or html")
            respondWithError(context: context, error: "Missing required fields")
            return
        }

        let title = message["title"] as? String
        let recipeSchema = message["recipeSchema"] as? [String: Any]

        logger.log("Saving recipe: \(url)")
        logger.log("HTML size: \(html.count) bytes")

        // Save to App Group container
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.recipearchive.shared"
        ) else {
            logger.error("Failed to access App Group container")
            respondWithError(context: context, error: "App Group access failed")
            return
        }

        // Ensure container directory exists
        try? FileManager.default.createDirectory(at: containerURL, withIntermediateDirectories: true, attributes: nil)

        // Create payload
        var payload: [String: Any] = [
            "url": url,
            "html": html,
            "timestamp": Date().timeIntervalSince1970,
            "source": "webextension"
        ]

        if let title = title {
            payload["title"] = title
        }

        if let schema = recipeSchema {
            payload["recipeSchema"] = schema
        }

        // Serialize and write to file
        let fileURL = containerURL.appendingPathComponent("shared_recipe.json")

        do {
            let data = try JSONSerialization.data(withJSONObject: payload, options: [])
            try data.write(to: fileURL, options: [])

            logger.log("Recipe saved successfully to: \(fileURL.path)")

            // Send success response back to JavaScript
            let response = NSExtensionItem()
            response.userInfo = [
                SFExtensionMessageKey: [
                    "success": true,
                    "message": "Recipe saved successfully"
                ]
            ]

            context.completeRequest(returningItems: [response], completionHandler: nil)

            // Try to notify the main app (may fail if app not running)
            notifyMainApp()

        } catch {
            logger.error("Failed to save recipe: \(error.localizedDescription)")
            respondWithError(context: context, error: "Failed to save: \(error.localizedDescription)")
        }
    }

    // Handle reading data from App Group
    private func handleGetAppGroupData(context: NSExtensionContext) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.recipearchive.shared"
        ) else {
            respondWithError(context: context, error: "App Group access failed")
            return
        }

        let fileURL = containerURL.appendingPathComponent("shared_recipe.json")

        do {
            let data = try Data(contentsOf: fileURL)
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let response = NSExtensionItem()
                response.userInfo = [
                    SFExtensionMessageKey: [
                        "success": true,
                        "data": json
                    ]
                ]
                context.completeRequest(returningItems: [response], completionHandler: nil)
            } else {
                respondWithError(context: context, error: "Invalid JSON data")
            }
        } catch {
            respondWithError(context: context, error: "Failed to read data: \(error.localizedDescription)")
        }
    }

    // Send error response
    private func respondWithError(context: NSExtensionContext, error: String) {
        let response = NSExtensionItem()
        response.userInfo = [
            SFExtensionMessageKey: [
                "success": false,
                "error": error
            ]
        ]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    // Notify main app via CFNotificationCenter
    private func notifyMainApp() {
        // Post notification that main app can listen for
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName("com.recipearchive.newRecipe" as CFString),
            nil,
            nil,
            true
        )

        logger.log("Posted notification to main app")
    }
}
