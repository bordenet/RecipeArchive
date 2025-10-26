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
    // When opened via share extension, the app is already running
    // The URL checking happens in the Flutter side via checkForSharedUrl
    return true
  }

  private func checkForSharedUrl() -> String? {
    print("DEBUG AppDelegate: Checking for shared URL...")
    let defaults = UserDefaults(suiteName: appGroupName)

    // Check if there's a shared URL
    guard let urlString = defaults?.string(forKey: "shared_url"),
          let timestamp = defaults?.object(forKey: "shared_url_timestamp") as? Date else {
      print("DEBUG AppDelegate: No shared URL found in App Group")
      return nil
    }

    print("DEBUG AppDelegate: Found shared URL: \(urlString), timestamp: \(timestamp)")

    // Only return URLs shared in the last 60 seconds to avoid processing old shares
    let timeSinceShare = Date().timeIntervalSince(timestamp)
    print("DEBUG AppDelegate: Time since share: \(timeSinceShare) seconds")
    guard timeSinceShare < 60 else {
      print("DEBUG AppDelegate: Timeout expired, ignoring old share")
      return nil
    }

    print("DEBUG AppDelegate: Returning shared URL: \(urlString)")

    // Clear the shared URL so we don't process it again
    defaults?.removeObject(forKey: "shared_url")
    defaults?.removeObject(forKey: "shared_url_timestamp")
    defaults?.synchronize()

    return urlString
  }
}
