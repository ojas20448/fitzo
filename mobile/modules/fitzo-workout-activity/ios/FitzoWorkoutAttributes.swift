import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct FitzoWorkoutAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var currentExercise: String
    var completedSets: Int
    var totalSets: Int
  }

  var sessionId: String
  var startedAt: Date
}
