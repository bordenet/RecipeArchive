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

    // Listen for notifications from Safari Web Extension
    setupWebExtensionListener()

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Setup listener for Safari Web Extension notifications
  private func setupWebExtensionListener() {
    let notificationName = CFNotificationName("com.recipearchive.newRecipe" as CFString)

    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      Unmanaged.passUnretained(self).toOpaque(),
      { (_, observer, _, _, _) in
        guard let observer = observer else { return }
        let appDelegate = Unmanaged<AppDelegate>.fromOpaque(observer).takeUnretainedValue()
        appDelegate.handleWebExtensionNotification()
      },
      notificationName.rawValue,
      nil,
      .deliverImmediately
    )
  }

  // Handle notification from Web Extension
  @objc private func handleWebExtensionNotification() {
    print("DEBUG AppDelegate: Received Web Extension notification")
    notifyFlutterOfSharedUrl()
  }

  // Handle custom URL scheme (recipearchive://)
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
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

    // Check queue directory for multiple recipes
    let queueURL = containerURL.appendingPathComponent("recipe_queue")

    // Get all queued recipe files sorted by timestamp (oldest first)
    guard let files = try? FileManager.default.contentsOfDirectory(at: queueURL, includingPropertiesForKeys: [.creationDateKey], options: .skipsHiddenFiles) else {
        return nil
    }

    let recipeFiles = files.filter { $0.pathExtension == "json" }
        .sorted { (url1, url2) -> Bool in
            let date1 = (try? url1.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? Date.distantPast
            let date2 = (try? url2.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? Date.distantPast
            return date1 < date2
        }

    guard let firstFile = recipeFiles.first else {
        return nil
    }

    print("DEBUG AppDelegate: Processing queued recipe: \(firstFile.lastPathComponent)")
    print("DEBUG AppDelegate: \(recipeFiles.count) recipe(s) in queue")

    do {
        let data = try Data(contentsOf: firstFile)
        guard let payload = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
              let urlString = payload["url"] as? String else {
            // Invalid file, remove it
            try? FileManager.default.removeItem(at: firstFile)
            return nil
        }

        // Create JSON payload for Flutter (include images if present)
        var resultPayload: [String: Any] = ["url": urlString]
        if let html = payload["html"] as? String {
            resultPayload["html"] = html
        }
        if let images = payload["images"] as? [[String: Any]] {
            resultPayload["images"] = images
        }

        // Delete the file after reading
        try? FileManager.default.removeItem(at: firstFile)
        print("DEBUG AppDelegate: Removed processed recipe from queue. \(recipeFiles.count - 1) remaining")

        // Return JSON string
        if let jsonData = try? JSONSerialization.data(withJSONObject: resultPayload, options: []),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            return jsonString
        }
    } catch {
        print("ERROR AppDelegate: Failed to process queued recipe: \(error)")
        // Remove corrupted file
        try? FileManager.default.removeItem(at: firstFile)
        return nil
    }

    return nil
  }
}
