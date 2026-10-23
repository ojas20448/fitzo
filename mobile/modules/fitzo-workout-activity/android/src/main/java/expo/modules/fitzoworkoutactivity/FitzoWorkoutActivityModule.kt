package expo.modules.fitzoworkoutactivity

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class WorkoutActivityRecord : Record {
  @Field val sessionId: String = ""
  @Field val title: String = "Workout"
  @Field val currentExercise: String = ""
  @Field val startedAtMs: Double = 0.0
  @Field val completedSets: Int = 0
  @Field val totalSets: Int = 0
}

class FitzoWorkoutActivityModule : Module() {
  companion object {
    const val CHANNEL_ID = "workout-active"
    const val NOTIFICATION_ID = 26320
  }

  override fun definition() = ModuleDefinition {
    Name("FitzoWorkoutActivity")

    AsyncFunction("sync") { record: WorkoutActivityRecord ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (!manager.areNotificationsEnabled()) return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        return@AsyncFunction false
      }
      val channel = NotificationChannel(CHANNEL_ID, "Active workout", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Elapsed time and progress for your current workout"
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PRIVATE
      }
      manager.createNotificationChannel(channel)
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return@AsyncFunction false
      launch.action = Intent.ACTION_VIEW
      launch.data = Uri.parse("fitzo://log/workout")
      launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      val pending = PendingIntent.getActivity(context, NOTIFICATION_ID, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val progress = "${record.completedSets}/${record.totalSets} sets"
      val detail = if (record.currentExercise.isBlank()) progress else "$progress · ${record.currentExercise}"
      val notification = Notification.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_workout_activity)
        .setContentTitle("${record.title} · Workout in progress")
        .setContentText(detail)
        .setStyle(Notification.BigTextStyle().bigText("$detail\nTap to return to your workout"))
        .setContentIntent(pending)
        .setCategory(Notification.CATEGORY_PROGRESS)
        .setWhen(record.startedAtMs.toLong())
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setChronometerCountDown(false)
        .setOnlyAlertOnce(true)
        .setOngoing(true)
        .setAutoCancel(false)
        .setVisibility(Notification.VISIBILITY_PRIVATE)
        .build()
      // One stable ID updates the existing card instead of creating a notification per set.
      manager.notify(NOTIFICATION_ID, notification)
      true
    }

    AsyncFunction("stop") {
      val context = appContext.reactContext
      if (context != null) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)
      }
    }
  }
}
