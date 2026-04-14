# Podwires Community Desktop

Native desktop wrapper for [community.podwires.com](https://community.podwires.com) — Windows, macOS, and Linux.

Repo: <https://github.com/realmikosantos/community-desktop>
Downloads: <https://github.com/realmikosantos/community-desktop/releases/latest>

Thin Electron shell around the live Next.js community platform. The site
already ships a PWA (`manifest.json` + `sw.js` in
`podwires-community/client/public/`), so offline support, caching, and
push notifications come from the app itself.

## What the wrapper adds on top

- Native window chrome, dock icon, taskbar integration
- Window bounds persisted across launches
- Native application menu with File / Edit / View / Navigate / Help
- External links (outside podwires.com + community.podwires.com) open in the
  user's default browser
- Single-instance lock
- Custom protocol handler `podwires-community://`
- Branded User-Agent (`PodwiresCommunityDesktop/<version>`)
- The WordPress SSO gateway at `podwires.com/go/community/` is whitelisted,
  so JWT login round-trips stay inside the app window
- Graceful offline landing page if the site is unreachable

## Requirements

- Node.js ≥ 20
- npm

## Develop

```bash
cd community-desktop
npm install
npm start          # runs against https://community.podwires.com
```

## Build installers

```bash
npm run dist:mac      # .dmg + .zip  (arm64 + x64)
npm run dist:win      # .exe (NSIS) + portable
npm run dist:linux    # AppImage + .deb
```

Artifacts land in `dist/`.

## Relationship to the rest of the monorepo

- Wraps the Next.js app in `COMMUNITY/podwires-community/client/`.
- Reuses icons from `aktor-theme/assets/images/`.
- Decoupled from the backend — no DB or env coupling, ship independently.
- Download links on podwires.com are driven by
  `aktor-theme/inc/desktop-app.php` → Customizer → "Podwires Community"
  section.

## Release flow

Same as podwires-desktop: push a `v*` tag to trigger the GitHub Actions
workflow (when added), or build manually and attach the `dist/` artifacts
to a GitHub Release.
