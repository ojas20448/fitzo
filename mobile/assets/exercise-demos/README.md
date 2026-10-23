# Exercise demonstrations

Six original, animated GIFs are bundled for push-ups, bodyweight squats, sit-ups, lying leg raises, jump rope and pull-ups. They are matched only to the named movements in `SOURCES.json`; specialised variants do not inherit a generic demonstration.

Each record in [SOURCES.json](./SOURCES.json) identifies the author, original file, source page and applicable Creative Commons license. GIFs are unchanged. JPG posters are extracted first frames and remain under the same license as the corresponding original. The app displays source and license links in the exercise guide. These licenses apply to these media files and their posters.

Poster filenames end in `-poster.jpg` so they have distinct Android resource names from the GIFs. Keep this suffix when regenerating media.

The separate `src/data/exercisePhotos.json` manifest contains 873 exact exercise names with photo paths from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), the same public-domain photo collection already used in Fitzo. It contains paths, not copied image binaries. Existing Supabase photos are retained, with the upstream original available as fallback.

Regenerate with Node.js, ffmpeg and ffprobe:

```
node backend/scripts/build_open_exercise_media.cjs
```

The paid ExerciseDB endpoint rejected the configured subscription with HTTP 403. No paid plan was purchased. These six GIFs and the photo manifest do not provide animated coverage of every exercise in that catalogue.
