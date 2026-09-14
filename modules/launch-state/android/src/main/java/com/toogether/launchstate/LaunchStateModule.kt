package com.toogether.launchstate

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LaunchStateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LaunchState")

    // A function rather than a constant so the value is read when JS asks for it, not whenever
    // the module happens to be instantiated.
    Function("wasRestoredBySystem") {
      LaunchStateRecorder.restoredBySystem
    }
  }
}
