import ActivityKit
import ExpoModulesCore
import UIKit

struct WorkoutActivityRecord: Record {
  @Field var sessionId: String = ""
  @Field var title: String = "Workout"
  @Field var currentExercise: String = ""
  @Field var startedAtMs: Double = 0
  @Field var completedSets: Int = 0
  @Field var totalSets: Int = 0
}

public class FitzoWorkoutActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FitzoWorkoutActivity")

    AsyncFunction("sync") { (record: WorkoutActivityRecord) async throws -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
      let startedAt = Date(timeIntervalSince1970: record.startedAtMs / 1000)
      let state = FitzoWorkoutAttributes.ContentState(
        title: record.title, currentExercise: record.currentExercise,
        completedSets: record.completedSets, totalSets: record.totalSets
      )
      let content = ActivityContent(state: state, staleDate: nil)
      var existing: Activity<FitzoWorkoutAttributes>?
      for activity in Activity<FitzoWorkoutAttributes>.activities {
        if activity.attributes.sessionId == record.sessionId {
          existing = activity
        } else {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      if let existing {
        await existing.update(content)
        return true
      }
      // ActivityKit permits starting an activity only while the app is active.
      guard await MainActor.run(body: { UIApplication.shared.applicationState == .active }) else { return false }
      let attributes = FitzoWorkoutAttributes(sessionId: record.sessionId, startedAt: startedAt)
      _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
      return true
    }

    AsyncFunction("stop") { () async -> Void in
      if #available(iOS 16.2, *) {
        for activity in Activity<FitzoWorkoutAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }
  }
}
