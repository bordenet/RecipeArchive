//
//  SafariWebExtensionHandler.swift
//  RecipeExtension
//
//  Handles communication between Safari Web Extension and native app
//

import SafariServices
import os.log
import Shared

/// Handler for Safari Web Extension native messaging
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.recipearchive.RecipeExtension", category: "Handler")
    private let recipeQueueService = RecipeQueueService()
    private let notificationBridge = NotificationBridge()

    // MARK: - NSExtensionRequestHandling

    func beginRequest(with context: NSExtensionContext) {
        logger.log("Safari Web Extension request received")

        guard let message = extractMessage(from: context) else {
            logger.error("No valid message found in request")
            respondWithError(context: context, error: "No valid message")
            return
        }

        logger.log("Received message: \(String(describing: message))")

        guard let action = message["action"] as? String else {
            respondWithError(context: context, error: "No action specified")
            return
        }

        handleAction(action, message: message, context: context)
    }

    // MARK: - Private Methods - Message Handling

    private func extractMessage(from context: NSExtensionContext) -> [String: Any]? {
        guard let request = context.inputItems.first as? NSExtensionItem,
              let message = request.userInfo?[SFExtensionMessageKey] as? [String: Any] else {
            return nil
        }
        return message
    }

    private func handleAction(_ action: String, message: [String: Any], context: NSExtensionContext) {
        switch action {
        case "saveRecipe":
            handleSaveRecipe(message: message, context: context)
        case "getAppGroupData":
            handleGetAppGroupData(context: context)
        default:
            logger.warning("Unknown action: \(action)")
            respondWithError(context: context, error: "Unknown action")
        }
    }

    // MARK: - Private Methods - Save Recipe

    private func handleSaveRecipe(message: [String: Any], context: NSExtensionContext) {
        guard let urlString = message["url"] as? String,
              let url = URL(string: urlString),
              let html = message["html"] as? String else {
            logger.error("Missing required fields: url or html")
            respondWithError(context: context, error: "Missing required fields")
            return
        }

        logger.log("Saving recipe: \(urlString)")
        logger.log("HTML size: \(html.count) bytes")

        do {
            try recipeQueueService.enqueue(url: url, html: html, images: [])
            logger.log("Recipe saved successfully")

            respondWithSuccess(context: context, message: "Recipe saved successfully")
            notificationBridge.postNotification()

        } catch {
            logger.error("Failed to save recipe: \(error.localizedDescription)")
            respondWithError(context: context, error: "Failed to save: \(error.localizedDescription)")
        }
    }

    // MARK: - Private Methods - Get App Group Data

    private func handleGetAppGroupData(context: NSExtensionContext) {
        if let item = recipeQueueService.dequeueNext(),
           let jsonString = item.jsonString,
           let data = jsonString.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            respondWithSuccess(context: context, data: json)
        } else {
            respondWithError(context: context, error: "No data available")
        }
    }

    // MARK: - Private Methods - Response Helpers

    private func respondWithSuccess(context: NSExtensionContext, message: String? = nil, data: [String: Any]? = nil) {
        var response: [String: Any] = ["success": true]

        if let message = message {
            response["message"] = message
        }
        if let data = data {
            response["data"] = data
        }

        let extensionItem = NSExtensionItem()
        extensionItem.userInfo = [SFExtensionMessageKey: response]
        context.completeRequest(returningItems: [extensionItem], completionHandler: nil)
    }

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
}
