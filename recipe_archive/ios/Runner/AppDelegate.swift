import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  private let shareChannelName = "com.recipearchive/share"
  private let appGroupName = "group.com.recipearchive.RecipeArchive"

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
    // When opened via share extension, the app is already running
    // The URL checking happens in the Flutter side via checkForSharedUrl
    let shareChannel = FlutterMethodChannel(name: shareChannelName, binaryMessenger: (window?.rootViewController as! FlutterViewController).binaryMessenger)
    if let url = checkForSharedUrl() {
        shareChannel.invokeMethod("sharedUrl", arguments: url)
    }
    return true
  }

  private func checkForSharedUrl() -> String? {
    let defaults = UserDefaults(suiteName: appGroupName)
    guard let urlString = defaults?.string(forKey: "shared_url") else { return nil }
    let htmlString = defaults?.string(forKey: "shared_html")

    // Create JSON payload
    var payload: [String: Any] = ["url": urlString]
    if let html = htmlString {
        payload["html"] = html
    }

    // Return JSON string
    if let jsonData = try? JSONSerialization.data(withJSONObject: payload, options: []),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        // Clear all shared data
        defaults?.removeObject(forKey: "shared_url")
        defaults?.removeObject(forKey: "shared_url_timestamp")
        defaults?.removeObject(forKey: "shared_html")
        defaults?.synchronize()
        return jsonString
    }

    // Fallback to plain URL string
    return urlString
  }
}
