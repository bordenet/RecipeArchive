//
//  AppDelegate.swift
//  Runner
//
//  Main application delegate for Recipe Archive
//

import Flutter
import UIKit

@main
@objc final class AppDelegate: FlutterAppDelegate {

    // MARK: - Properties

    private let flutterBridge = FlutterBridge()
    private let notificationBridge = NotificationBridge()

    // MARK: - Application Lifecycle

    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        GeneratedPluginRegistrant.register(with: self)

        setupFlutterBridge()
        setupNotificationListener()

        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }

    // MARK: - URL Handling

    override func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        // Handle recipearchive:// custom URL scheme
        flutterBridge.notifyFlutterOfSharedUrl()
        return true
    }

    override func applicationWillEnterForeground(_ application: UIApplication) {
        // Check for shared recipes when app enters foreground
        flutterBridge.notifyFlutterOfSharedUrl()
    }

    // MARK: - Private Methods - Setup

    private func setupFlutterBridge() {
        guard let controller = window?.rootViewController as? FlutterViewController else {
            return
        }
        flutterBridge.setupChannel(with: controller)
    }

    private func setupNotificationListener() {
        notificationBridge.addObserver(self) { [weak self] in
            self?.handleWebExtensionNotification()
        }
    }

    // MARK: - Private Methods - Notification Handling

    @objc private func handleWebExtensionNotification() {
        print("DEBUG AppDelegate: Received Web Extension notification")
        flutterBridge.notifyFlutterOfSharedUrl()
    }
}
