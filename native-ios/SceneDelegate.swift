import UIKit

/// iOS 27 added a launch-time validator that aborts any app which has not
/// adopted the `UIScene` lifecycle. The trap is
/// `EXC_BREAKPOINT` / `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`,
/// raised from `-[UIApplication workspace:didCreateScene:...]` before any
/// JavaScript runs. Expo SDK 57 / RN 0.86 still create the React Native window
/// from `AppDelegate` alone, so the already-built window is adopted by the
/// scene here instead of duplicating the React Native setup.
///
/// Pairs with `UIApplicationSceneManifest` in Info.plist, which the
/// iOS 27 validator inspects statically -- declaring the scene delegate at
/// runtime alone is not enough.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let appWindow = appDelegate.window
    else {
      return
    }

    window = appWindow
    appWindow.windowScene = windowScene
    appWindow.makeKeyAndVisible()
  }
}
