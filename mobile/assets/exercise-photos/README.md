# Bundled workout photos

These 125 unchanged JPEGs are the existing built-in exercise photos from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db). The upstream project uses the [Unlicense](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md).

`SOURCES.json` records each stable exercise ID, original URL, file size and SHA-256. `exerciseTechniqueGuides.json` contains unchanged instructions matched to the exact source-image folder for 123 movements. The catalog contains the same close-grip bench press twice; it is bundled once. Rebuild and validate the images, guides and static imports with:

```
node backend/scripts/bundle_workout_photos.cjs
```

These are still photos, not animations. Licensed animated demos and their attribution are kept separately in `../exercise-demos/`.
