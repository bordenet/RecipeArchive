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

    print("DEBUG AppDelegate: Setting up share channel")

    shareChannel.setMethodCallHandler { [weak self] (call: FlutterMethodCall, result: @escaping FlutterResult) in
      print("DEBUG AppDelegate: Received method call: \(call.method)")
      guard let self = self else { return }

      if call.method == "checkForSharedUrl" {
        print("DEBUG AppDelegate: Calling checkForSharedUrl()")
        let url = self.checkForSharedUrl()
        print("DEBUG AppDelegate: Returning result: \(url ?? "nil")")
        result(url)
      } else {
        print("DEBUG AppDelegate: Method not implemented: \(call.method)")
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
    print("DEBUG AppDelegate: application:open:options: called with URL: \(url)")
    // When opened via share extension with recipearchive:// scheme
    notifyFlutterOfSharedUrl()
    return true
  }

  // Called when app enters foreground (user manually switches to app)
  override func applicationWillEnterForeground(_ application: UIApplication) {
    print("DEBUG AppDelegate: applicationWillEnterForeground called")
    notifyFlutterOfSharedUrl()
  }

  private func notifyFlutterOfSharedUrl() {
    guard let jsonString = checkForSharedUrl() else {
      print("DEBUG AppDelegate: No shared URL found")
      return
    }

    print("DEBUG AppDelegate: Notifying Flutter of shared URL")
    guard let controller = window?.rootViewController as? FlutterViewController else {
      print("DEBUG AppDelegate: Could not get FlutterViewController")
      return
    }

    let shareChannel = FlutterMethodChannel(name: shareChannelName, binaryMessenger: controller.binaryMessenger)
    shareChannel.invokeMethod("sharedUrl", arguments: jsonString)
  }

  private func checkForSharedUrl() -> String? {
    print("DEBUG AppDelegate: Checking App Group: \(appGroupName)")

    guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupName) else {
        print("DEBUG AppDelegate: ERROR - Could not get container URL for App Group!")
        return nil
    }

    print("DEBUG AppDelegate: App Group container path: \(containerURL.path)")

    // Read from file (more reliable for Catalyst than UserDefaults)
    let fileURL = containerURL.appendingPathComponent("shared_recipe.json")

    guard FileManager.default.fileExists(atPath: fileURL.path) else {
        print("DEBUG AppDelegate: No shared recipe file found at: \(fileURL.path)")
        return nil
    }

    do {
        let data = try Data(contentsOf: fileURL)
        guard let payload = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
              let urlString = payload["url"] as? String else {
            print("DEBUG AppDelegate: Invalid JSON in shared file")
            return nil
        }

        print("DEBUG AppDelegate: Found shared URL: \(urlString)")

        // Create JSON payload for Flutter
        var resultPayload: [String: Any] = ["url": urlString]
        if let html = payload["html"] as? String {
            resultPayload["html"] = html
            print("DEBUG AppDelegate: Also found HTML (\(html.count) chars)")
        }

        // Delete the file after reading
        try? FileManager.default.removeItem(at: fileURL)
        print("DEBUG AppDelegate: Deleted shared file")

        // Return JSON string
        if let jsonData = try? JSONSerialization.data(withJSONObject: resultPayload, options: []),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            return jsonString
        }
    } catch {
        print("DEBUG AppDelegate: Error reading shared file: \(error)")
    }

    return nil
  }
}
