package com.toogether.launchstate

import android.content.Context
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

// Discovered by Expo autolinking (a *Package.kt file importing expo.modules.core.interfaces.Package)
// and invoked from MainApplication's ApplicationLifecycleDispatcher.onApplicationCreate, which runs
// before any activity exists.
class LaunchStatePackage : Package {
  override fun createApplicationLifecycleListeners(context: Context?): List<ApplicationLifecycleListener> =
    listOf(LaunchStateLifecycleListener())
}
