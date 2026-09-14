package com.toogether.launchstate

import android.app.Activity
import android.app.Application
import android.os.Build
import android.os.Bundle
import expo.modules.core.interfaces.ApplicationLifecycleListener

/**
 * Records whether Android created this process's first activity from saved instance state.
 *
 * Android keeps an activity's saved state with its task in recents. If the system reclaims the
 * process while the app sits in the background, reopening the app recreates the activity with that
 * state (non-null). If the user swipes the app out of recents, the task and its saved state are
 * discarded, so the next launch starts with none (null), exactly like a first launch.
 *
 * MainActivity (Expo template) calls `super.onCreate(null)`, so every create callback that runs
 * inside onCreate, Expo's ReactActivityLifecycleListener included, sees null. The public
 * `onActivityPreCreated` callback (API 29+) is dispatched by Activity.performCreate with the bundle
 * the system actually delivered, before onCreate runs, so it still sees the real value. Below API 29
 * nothing is recorded and the app keeps the fresh-launch default.
 */
class LaunchStateLifecycleListener : ApplicationLifecycleListener {
  override fun onCreate(application: Application) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return
    }
    application.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
      override fun onActivityPreCreated(activity: Activity, savedInstanceState: Bundle?) {
        LaunchStateRecorder.recordFirstActivity(hasSavedState = savedInstanceState != null)
      }

      override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
      override fun onActivityStarted(activity: Activity) = Unit
      override fun onActivityResumed(activity: Activity) = Unit
      override fun onActivityPaused(activity: Activity) = Unit
      override fun onActivityStopped(activity: Activity) = Unit
      override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
      override fun onActivityDestroyed(activity: Activity) = Unit
    })
  }
}

internal object LaunchStateRecorder {
  // Written once on the main thread before JS starts; read later from the JS thread.
  @Volatile
  var restoredBySystem = false
    private set

  @Volatile
  private var recorded = false

  // Only the first activity of the process describes how the process came back. Later activities
  // (or a same-process recreation after a config change) must not overwrite it.
  fun recordFirstActivity(hasSavedState: Boolean) {
    if (recorded) return
    recorded = true
    restoredBySystem = hasSavedState
  }
}
