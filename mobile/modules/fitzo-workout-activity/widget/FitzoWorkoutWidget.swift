import ActivityKit
import SwiftUI
import WidgetKit

@main
struct FitzoWorkoutWidgetBundle: WidgetBundle {
  var body: some Widget { FitzoWorkoutWidget() }
}

struct FitzoWorkoutWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: FitzoWorkoutAttributes.self) { context in
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Label("WORKOUT IN PROGRESS", systemImage: "dumbbell.fill")
            .font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
          Spacer()
          elapsed(context.attributes.startedAt).font(.title3.weight(.semibold))
        }
        Text(context.state.title).font(.headline).lineLimit(1)
        HStack {
          Text(context.state.currentExercise).font(.subheadline).lineLimit(1)
          Spacer()
          Text("\(context.state.completedSets)/\(context.state.totalSets) sets")
            .font(.subheadline.monospacedDigit()).foregroundStyle(Color(red: 0.38, green: 0.65, blue: 0.98))
        }
        Text("Tap to return to your workout").font(.caption).foregroundStyle(.secondary)
      }
      .padding(16)
      .activityBackgroundTint(.black)
      .activitySystemActionForegroundColor(.white)
      .foregroundStyle(.white)
      .widgetURL(URL(string: "fitzo://log/workout"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label("Fitzo", systemImage: "dumbbell.fill").font(.headline)
        }
        DynamicIslandExpandedRegion(.trailing) { elapsed(context.attributes.startedAt) }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            VStack(alignment: .leading) {
              Text(context.state.title).font(.headline).lineLimit(1)
              Text(context.state.currentExercise).font(.caption).lineLimit(1).foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(context.state.completedSets)/\(context.state.totalSets) sets").font(.caption.monospacedDigit())
          }
        }
      } compactLeading: {
        Image(systemName: "dumbbell.fill")
      } compactTrailing: {
        elapsed(context.attributes.startedAt).frame(width: 58)
      } minimal: {
        Image(systemName: "dumbbell.fill")
      }
      .widgetURL(URL(string: "fitzo://log/workout"))
      .keylineTint(.white)
    }
  }

  private func elapsed(_ startedAt: Date) -> some View {
    Text(startedAt, style: .timer)
      .monospacedDigit()
  }
}
