import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  private let shareChannelName = "com.recipearchive/share"
  private let appGroupName = "group.com.recipearchive.shared"

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // Set up share channel
    let controller = window?.rootViewController as! FlutterViewController
    let shareChannel = FlutterMethodChannel(name: shareChannelName, binaryMessenger: controller.binaryMessenger)

    shareChannel.setMethodCallHandler { [weak self] (call: FlutterMethodCall, result: @escaping FlutterResult) in
      guard let self = self else { return }

      if call.method == "checkForSharedUrl" {
        result(self.checkForSharedUrl())
      } else {
        result(FlutterMethodNotImplemented)
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Handle custom URL scheme (recipearchive://)
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    // When opened via share extension with recipearchive:// scheme
    notifyFlutterOfSharedUrl()
    return true
  }

  // Called when app enters foreground (user manually switches to app)
  override func applicationWillEnterForeground(_ application: UIApplication) {
    notifyFlutterOfSharedUrl()
  }

  private func notifyFlutterOfSharedUrl() {
    guard let jsonString = checkForSharedUrl(),
          let controller = window?.rootViewController as? FlutterViewController else {
      return
    }

    let shareChannel = FlutterMethodChannel(name: shareChannelName, binaryMessenger: controller.binaryMessenger)
    shareChannel.invokeMethod("sharedUrl", arguments: jsonString)
  }

  private func checkForSharedUrl() -> String? {
    guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupName) else {
        return nil
    }

    // Read from file (more reliable for Catalyst than UserDefaults)
    let fileURL = containerURL.appendingPathComponent("shared_recipe.json")

    guard FileManager.default.fileExists(atPath: fileURL.path) else {
        return nil
    }

    do {
        let data = try Data(contentsOf: fileURL)
        guard let payload = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
              let urlString = payload["url"] as? String else {
            return nil
        }

        // Create JSON payload for Flutter
        var resultPayload: [String: Any] = ["url": urlString]
        if let html = payload["html"] as? String {
            resultPayload["html"] = html
        }

        // Delete the file after reading
        try? FileManager.default.removeItem(at: fileURL)

        // Return JSON string
        if let jsonData = try? JSONSerialization.data(withJSONObject: resultPayload, options: []),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            return jsonString
        }
    } catch {
        return nil
    }

    return nil
  }
}
