//
//  FlutterBridge.swift
//  Runner
//
//  Handles communication between iOS and Flutter
//

import Flutter
import Foundation

/// Service for managing communication between iOS and Flutter
final class FlutterBridge {

    // MARK: - Properties

    private let channelName: String
    private let recipeQueueService: RecipeQueueService
    private weak var controller: FlutterViewController?

    // MARK: - Initialization

    init(channelName: String = "com.recipearchive/share",
         recipeQueueService: RecipeQueueService = RecipeQueueService()) {
        self.channelName = channelName
        self.recipeQueueService = recipeQueueService
    }

    // MARK: - Public Methods

    /// Sets up the method channel with Flutter
    func setupChannel(with controller: FlutterViewController) {
        self.controller = controller

        let channel = FlutterMethodChannel(
            name: channelName,
            binaryMessenger: controller.binaryMessenger
        )

        channel.setMethodCallHandler { [weak self] call, result in
            guard let self = self else {
                result(FlutterMethodNotImplemented)
                return
            }

            if call.method == "checkForSharedUrl" {
                result(self.checkForSharedUrl())
            } else {
                result(FlutterMethodNotImplemented)
            }
        }
    }

    /// Notifies Flutter of a new shared URL
    func notifyFlutterOfSharedUrl() {
        guard let jsonString = checkForSharedUrl(),
              let controller = controller else {
            return
        }

        let channel = FlutterMethodChannel(
            name: channelName,
            binaryMessenger: controller.binaryMessenger
        )
        channel.invokeMethod("sharedUrl", arguments: jsonString)
    }

    // MARK: - Private Methods

    private func checkForSharedUrl() -> String? {
        guard let item = recipeQueueService.dequeueNext() else {
            return nil
        }
        return item.jsonString
    }
}
