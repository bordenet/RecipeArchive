//
//  NotificationBridge.swift
//  RecipeArchive
//
//  Handles notifications between app components and Flutter
//

import Foundation

/// Service for managing notifications between iOS components and Flutter
public final class NotificationBridge {

    // MARK: - Properties

    private let notificationName: CFNotificationName

    // MARK: - Initialization

    public init(notificationName: String = "com.recipearchive.newRecipe") {
        self.notificationName = CFNotificationName(notificationName as CFString)
    }

    // MARK: - Public Methods

    /// Posts a notification that can be received by other app components
    public func postNotification() {
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            notificationName,
            nil,
            nil,
            true
        )
    }

    /// Sets up a listener for notifications
    public func addObserver(_ observer: AnyObject, callback: @escaping () -> Void) {
        let observerPointer = Unmanaged.passUnretained(observer).toOpaque()

        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            observerPointer,
            { (_, observer, _, _, _) in
                guard let observer = observer else { return }
                let wrapper = Unmanaged<ObserverWrapper>.fromOpaque(observer).takeUnretainedValue()
                wrapper.callback()
            },
            notificationName.rawValue,
            nil,
            .deliverImmediately
        )

        // Store callback in associated object
        let wrapper = ObserverWrapper(callback: callback)
        objc_setAssociatedObject(
            observer,
            &NotificationBridge.callbackKey,
            wrapper,
            .OBJC_ASSOCIATION_RETAIN
        )
    }

    // MARK: - Private Properties

    private static var callbackKey: UInt8 = 0

    // MARK: - Helper Class

    private class ObserverWrapper {
        let callback: () -> Void

        init(callback: @escaping () -> Void) {
            self.callback = callback
        }
    }
}
