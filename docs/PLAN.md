# Plan

## Goal

Show users how to place badges on the Singapore Army uniform, in a character-creator style app for iOS and
Android. Start as a web page to test features.

## Decisions so far

- **Web first, native later.** Vite + React + TypeScript. Wrap with Capacitor for iOS and Android from the same code.
- **Everything is data.** Uniform, anchor points, badge catalogue and rules are JSON validated by zod. Adding a badge is: drop in a PNG, run `npm run data:sync`.
- **First uniform: Number 1** (white stand-collar tunic), upper body only, front view. Numbers 3 and 5 follow.
- **Rules only from sources.** Current rules come from https://www.army.gov.sg/our-forces/badges/ (where each category is worn, max 2 proficiency badges, max 2 skills tabs, exceptional skills take precedence over skills). Positions and sizes that are not stated are marked unverified.
- **Art style** follows the Nano Banana Number 1 sample. Badge art is made by the separate `badge-art-pipeline` project (raw photos in, flat art and perspective sprites out) and imported here (`docs/ART.md`). The photos are never shipped.

## Roadmap

- [x] Project skeleton, data schema, validation script, unit tests
- [x] Catalogue of all 75 badges from the army.gov.sg page (8 categories)
- [x] Number 1 uniform with 6 anchor spots (approximate)
- [x] Click-to-place, max-per-category rule, anchor overlay, size slider, saved state
- [x] Draft redrawn art for the proficiency badges (IPPT Gold, IPPT Silver, Marksmanship)
- [ ] Redrawn art for the other 72 badges, starting with the arms badges and skills tabs
- [x] Art pipeline split into its own program, `badge-art-pipeline`; this app imports its bundles (`npm run art:import`, `docs/ART.md`)
- [x] No.1 accessories drawn as vector art (free route) in that project, vetted by automatic checks and an independent reviewer agent, in the library as Shoulder Boards / Rank Insignia / Gorgets
- [x] Perspective for sleeve, shoulder and collar mounts (computed in the pipeline, shipped as sprites)
- [x] 8 SAF service medals (Navy medals page, temporary list) drawn, vetted and in the library as Medals
- [x] Medals on the uniform: left-chest spot (top 6 cm above the flap, one row, order picked) and tall boxes
- [ ] Medals: order of wear (the SAF No.1 Dress PDF gives none), what to do when 7+ medals are wider than the chest, calibrate `pxPerMm`
- [x] Perspective in the app: pre-rendered sprites for shoulders, sleeves (incl. proficiency badges) and collar; sleeve badges tucked under the curved sleeve outline
- [x] Selection screen (Service, Gender, Uniform, Rank, Branch) before the uniform; rank places its board, insignia and gorget from the data, branch places the collar badge; the library is badges and medals only
- [ ] Drag to move a badge between its allowed spots; snap to anchor
- [ ] Placement guides with measurements ("1 cm above the pocket") once a regulation source is found
- [ ] Learning modes: quiz ("place this badge"), checklist, compare with the correct placement
- [x] Uniform picker; No. 3 and No. 5 drawings registered for every service and gender (anchors copied from No. 1, unverified, flat art)
- [ ] Collar sprites if No. 3 or No. 5 ever get a collar badge; service-specific rank art for RSAF and RSN (hooks are in place: `artVariants`); a female No. 1 drawing if one is wanted
- [ ] Capacitor wrapper: Android first, then iOS
- [ ] Redo the Number 1 uniform art at higher resolution (the current PNG is 741 x 680)

## Open questions (need the user or a regulation source)

1. Which badges are worn on which uniform (Number 1 / 3 / 5)? The page does not say.
2. Where are formation badges worn? The page does not say. Until answered they show "No placement spot".
3. Real sizes in mm for each badge and exact positions (distance from pocket, collar, seam). `widthMm` values are placeholders.
4. Is a badge order within a spot required (for example skills badge ranking)? Only "exceptional over skills" is stated.
5. Copyright: the page footer says "© 2026 Government of Singapore". Read its Terms of Use before any store release, and consider asking the Army for permission to depict the insignia.

## Open questions from the selection screen

1. LTG (Lieutenant-General) has a board but no gorget in the data. Left out until a source says otherwise.
2. Which branches RSAF and RSN have: the project owner says they are the same as the Army's, so all services list the same 12 arms badges.
3. Rank list order is presentation only (enlistee and specialist ranks first, then the WO, ME and officer boards, in file order). The data has no seniority order.
4. No. 3 and No. 5 follow the Army No. 1 placement rules (project owner). The SAF PDF section we have covers Army No. 1 only, so the positions on these 12 drawings are read off the pictures: boards, sleeve insignia and sleeve badges are drawn from the number-1 perspective sprites (`mountedFrom`; same shoulders and sleeves), and chest spots follow the drawn pocket flaps (No. 5 male) or the No. 1 coordinates (no flaps).
5. Incentive badges (pocket flap) have no spot on drawings without a flap.
6. RSAF and RSN rank art: the same Army art is used for every service until service-specific art exists.

## Art pipeline

Lives in the separate `badge-art-pipeline` project (README there). In short: raw photo library, then
`draw`, `compare`, `export`; here `npm run art:import`, `npm run data:validate`. See `docs/ART.md`.

Status: the three proficiency badges were generated with Figma's image tool (Gemini image model, text prompt
only, no reference photo), then processed with the pipeline's `process` command. They match the flat style
but were not generated from the official photos, so treat them as drafts: compare each with its reference
photo and regenerate if details are wrong (for example the real IPPT Silver is a darker gunmetal, and the
real rings are thicker). The 40 No.1 accessories come from the pipeline's vector route.

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
