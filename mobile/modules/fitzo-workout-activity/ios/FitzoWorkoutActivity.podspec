Pod::Spec.new do |s|
  s.name = 'FitzoWorkoutActivity'
  s.version = '1.0.0'
  s.summary = 'Fitzo active workout Live Activity'
  s.description = 'Local ActivityKit integration for an ongoing Fitzo workout.'
  s.author = 'Fitzo'
  s.homepage = 'https://www.fitzoapp.in'
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UIKit'
  s.weak_frameworks = 'ActivityKit'
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
