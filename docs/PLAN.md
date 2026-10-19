# Plan

## Goal

Show users how to place badges on the Singapore Army uniform, in a character-creator style app for iOS and
Android. Start as a web page to test features.

## Decisions so far

- **Web first, native later.** Vite + React + TypeScript. Wrap with Capacitor for iOS and Android from the same code.
- **Everything is data.** Uniform, anchor points, badge catalogue and rules are JSON validated by zod. Adding a badge is: drop in a PNG, run `npm run data:sync`.
- **First uniform: Number 1** (white stand-collar tunic), upper body only, front view. Numbers 3 and 5 follow.
- **Rules only from sources.** Current rules come from https://www.army.gov.sg/our-forces/badges/ (where each category is worn, max 2 proficiency badges, max 2 skills tabs, exceptional skills take precedence over skills). Positions and sizes that are not stated are marked unverified.
- **Art style** follows the Nano Banana Number 1 sample (`docs/STYLE.md`). Badges are redrawn with image models using the official photos as references. The photos are never shipped.

## Roadmap

- [x] Project skeleton, data schema, validation script, unit tests
- [x] Catalogue of all 75 badges from the army.gov.sg page (8 categories)
- [x] Number 1 uniform with 6 anchor spots (approximate)
- [x] Click-to-place, max-per-category rule, anchor overlay, size slider, saved state
- [x] Draft redrawn art for the proficiency badges (IPPT Gold, IPPT Silver, Marksmanship)
- [ ] Redrawn art for the other 72 badges, starting with the arms badges and skills tabs
- [ ] Drag to move a badge between its allowed spots; snap to anchor
- [ ] Placement guides with measurements ("1 cm above the pocket") once a regulation source is found
- [ ] Learning modes: quiz ("place this badge"), checklist, compare with the correct placement
- [ ] Uniform picker; Number 3 and Number 5 art and anchors
- [ ] Capacitor wrapper: Android first, then iOS
- [ ] Redo the Number 1 uniform art at higher resolution (the current PNG is 741 x 680)

## Open questions (need the user or a regulation source)

1. Which badges are worn on which uniform (Number 1 / 3 / 5)? The page does not say.
2. Where are formation badges worn? The page does not say. Until answered they show "No placement spot".
3. Real sizes in mm for each badge and exact positions (distance from pocket, collar, seam). `widthMm` values are placeholders.
4. Is a badge order within a spot required (for example skills badge ranking)? Only "exceptional over skills" is stated.
5. Copyright: the page footer says "© 2026 Government of Singapore". Read its Terms of Use before any store release, and consider asking the Army for permission to depict the insignia.

## Art pipeline

1. `npm run refs:fetch` downloads the reference photos (`reference/images/`, git-ignored).
2. Redraw with an image model that accepts a reference image (Nano Banana via Gemini, or via Weave in Figma). Figma's `generate_image` tool is text-only, so it cannot use the photo as a reference.
3. Remove the background, resize to 512 x 512 PNG, save to `public/badges/<category>/<slug>.png`.
4. `npm run data:sync`, then check the badge on the uniform.

Status: the three proficiency badges were generated with Figma's image tool (Gemini image model, text prompt
only, no reference photo) in the file "Uniform visualiser - badge redraws", then processed with
`scripts/process_badge.py`. They match the flat style but were not generated from the official photos, so
treat them as drafts: compare each with its reference photo and regenerate if details are wrong (for
example the real IPPT Silver is a darker gunmetal, and the real rings are thicker).

## Mobile (Capacitor) outline

```
npm i @capacitor/core @capacitor/cli
npx cap init "Uniform Visualiser" com.example.uniformvisualiser --web-dir=dist
npm i @capacitor/android @capacitor/ios
npx cap add android
npm run build && npx cap sync
npx cap open android      # builds and runs in Android Studio
```

iOS builds need macOS with Xcode. From Windows, use a cloud macOS build service or a borrowed Mac.
Apple and Google developer accounts are needed to publish. Check the current Capacitor docs before running these.
