# Airbob Pre-Design QA Overlay Token Phase 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airbnb 스타일 디자인 적용 전에 남은 overlay 계층, token/breakpoint/z-index debt, 브라우저 QA, 커밋 단위 정리를 끝낸다.

**Architecture:** `Dialog`는 일반 modal/focus-trap/scroll-lock을 소유한다. 목적이 명확한 fullscreen media viewer만 별도 예외로 둘 수 있지만, 그 경우에도 접근성/키보드/토큰 계약을 테스트로 잠근다. CSS 정리는 전 앱을 한 번에 미는 대신 Search/Profile/Wishlist/Accommodation detail처럼 디자인 적용 영향이 큰 화면부터 계약을 확장한다.

**Tech Stack:** React 19, TypeScript 4.9, CSS Modules, React Testing Library, Jest, gstack QA.

---

## File Structure

- Modify: `src/components/components-boundary-contracts.test.ts`
  - unreferenced workflow modal이 `src/components`에 남지 않도록 `DateChangeModal`, `GuestChangeModal`을 generic boundary 금지 목록에 추가한다.
- Delete: `src/components/DateChangeModal/DateChangeModal.tsx`
- Delete: `src/components/DateChangeModal/DateChangeModal.module.css`
- Delete: `src/components/GuestChangeModal/GuestChangeModal.tsx`
- Delete: `src/components/GuestChangeModal/GuestChangeModal.module.css`
  - 현재 `rg "DateChangeModal|GuestChangeModal" src -g '*.tsx' -g '*.ts'` 결과상 자기 파일 외 import가 없으므로 삭제 대상이다.
- Modify: `src/features/accommodations/components/AccommodationImageGalleryModal.tsx`
  - `Dialog` fullscreen primitive로 이관하거나, fullscreen media viewer 예외로 남기는 경우 `role="dialog"`, `aria-modal`, Escape close, focus 대상, 명확한 button label을 직접 보장한다.
- Modify: `src/features/accommodations/components/AccommodationImageGalleryModal.module.css`
  - raw color/radius/z-index를 token으로 정리한다.
- Modify: `src/features/accommodations/components/AccommodationImageGalleryModal.test.tsx`
  - dialog semantics, Escape close, labelled controls, backdrop close, thumbnail navigation을 검증한다.
- Modify: `src/styles/tokens.test.ts`
  - high-impact page CSS를 token-owned list에 추가한다.
  - media query breakpoint allow-list를 추가한다.
  - local overlay z-index literal audit를 `z-index: 10`/`z-index: 100`까지 high-impact files에서 금지한다.
- Modify: high-impact CSS files as required by the new token/breakpoint contract:
  - `src/pages/Search/Search.module.css`
  - `src/pages/Wishlist/Wishlist.module.css`
  - `src/pages/Profile/Profile.module.css`
  - `src/features/accommodations/components/AccommodationBookingCard.module.css`
  - `src/features/accommodations/components/AccommodationHero.module.css`
  - `src/features/accommodations/components/AccommodationReviewsSection.module.css`
  - `src/features/accommodations/components/AccommodationDescriptionModal.module.css`
- QA artifact target: `.gstack/qa-reports/`
  - gstack QA report and screenshots for search/detail/modal flows.

---

### Task 1: Remove Unreferenced Generic Custom Modals

**Files:**
- Modify: `src/components/components-boundary-contracts.test.ts`
- Delete: `src/components/DateChangeModal/DateChangeModal.tsx`
- Delete: `src/components/DateChangeModal/DateChangeModal.module.css`
- Delete: `src/components/GuestChangeModal/GuestChangeModal.tsx`
- Delete: `src/components/GuestChangeModal/GuestChangeModal.module.css`

- [x] **Step 1: Verify the modals are still unreferenced**

Run:

```bash
rg "DateChangeModal|GuestChangeModal" src -g "*.tsx" -g "*.ts"
```

Expected: only the component implementation files and this boundary/test text appear. If a real import appears in a page or feature file, stop and migrate that modal to the owning feature instead of deleting it.

- [x] **Step 2: Add boundary contract before deletion**

In `src/components/components-boundary-contracts.test.ts`, update `forbiddenWorkflowDirectories`:

```ts
const forbiddenWorkflowDirectories = [
  "Map",
  "ReviewModal",
  "DateChangeModal",
  "GuestChangeModal",
];
```

- [x] **Step 3: Run boundary test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/components/components-boundary-contracts.test.ts --runInBand
```

Expected: FAIL listing `DateChangeModal` and `GuestChangeModal`.

- [x] **Step 4: Delete the unreferenced modal files**

Run:

```bash
git rm src/components/DateChangeModal/DateChangeModal.tsx \
  src/components/DateChangeModal/DateChangeModal.module.css \
  src/components/GuestChangeModal/GuestChangeModal.tsx \
  src/components/GuestChangeModal/GuestChangeModal.module.css
```

- [x] **Step 5: Run boundary test and verify it passes**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/components/components-boundary-contracts.test.ts --runInBand
```

Expected: PASS.

---

### Task 2: Stabilize Accommodation Image Gallery Overlay

**Files:**
- Modify: `src/features/accommodations/components/AccommodationImageGalleryModal.tsx`
- Modify: `src/features/accommodations/components/AccommodationImageGalleryModal.module.css`
- Modify: `src/features/accommodations/components/AccommodationImageGalleryModal.test.tsx`

- [x] **Step 1: Add failing accessibility tests**

Extend `AccommodationImageGalleryModal.test.tsx` with:

```tsx
it("exposes fullscreen gallery as an accessible dialog", () => {
  renderGalleryModal();

  expect(
    screen.getByRole("dialog", { name: "남산 전망 숙소 사진 갤러리" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "사진 갤러리 닫기" })
  ).toHaveFocus();
});

it("closes with Escape", () => {
  const { props } = renderGalleryModal();

  fireEvent.keyDown(
    screen.getByRole("dialog", { name: "남산 전망 숙소 사진 갤러리" }),
    { key: "Escape" }
  );

  expect(props.onClose).toHaveBeenCalledTimes(1);
});

it("uses labelled image navigation controls", () => {
  renderGalleryModal();

  expect(screen.getByRole("button", { name: "이전 사진" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "다음 사진" })).toBeInTheDocument();
});
```

- [x] **Step 2: Run gallery test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/components/AccommodationImageGalleryModal.test.tsx --runInBand
```

Expected: FAIL because the modal currently lacks dialog semantics and labelled controls.

- [x] **Step 3: Prefer `Dialog` fullscreen unless visual QA rejects it**

In `AccommodationImageGalleryModal.tsx`, import `Dialog`:

```ts
import { Dialog } from "../../../shared/ui";
```

Replace the outer custom overlay with:

```tsx
<Dialog
  bodyClassName={styles.galleryBody}
  bodyPadding="none"
  className={styles.galleryDialog}
  isOpen={isOpen}
  onClose={onClose}
  showHeader={false}
  size="fullscreen"
  title={`${accommodationName} 사진 갤러리`}
>
  <button
    type="button"
    aria-label="사진 갤러리 닫기"
    autoFocus
    className={styles.galleryClose}
    onClick={onClose}
  >
    ×
  </button>
  ...
</Dialog>
```

Update navigation buttons:

```tsx
<button
  type="button"
  aria-label="이전 사진"
  className={`${styles.galleryNav} ${styles.galleryPrev}`}
  onClick={goToPreviousImage}
  disabled={!showNavigation}
>
  ‹
</button>
<button
  type="button"
  aria-label="다음 사진"
  className={`${styles.galleryNav} ${styles.galleryNext}`}
  onClick={goToNextImage}
  disabled={!showNavigation}
>
  ›
</button>
```

- [x] **Step 4: Tokenize gallery CSS**

In `AccommodationImageGalleryModal.module.css`:
- Replace `.galleryModal`/`.galleryContent` shell with `.galleryDialog` and `.galleryBody`.
- Use `var(--radius-pill)` for circular controls.
- Use `var(--radius-md)` for thumbnails.
- Use `var(--color-text-primary)` instead of `#222222`.
- Use `var(--color-background-page)` or existing translucent white only where actual media overlay contrast requires it.
- Replace `z-index: 10` with no z-index or `z-index: 1` inside the Dialog body.

- [x] **Step 5: Run gallery tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/components/AccommodationImageGalleryModal.test.tsx src/shared/ui/Dialog/Dialog.test.tsx src/styles/tokens.test.ts --runInBand
```

Expected: PASS.

---

### Task 3: Expand Token, Z-Index, and Breakpoint Contracts

**Files:**
- Modify: `src/styles/tokens.test.ts`
- Modify CSS files listed in the File Structure section as needed.

- [x] **Step 1: Add high-impact token-owned CSS list**

In `src/styles/tokens.test.ts`, extend `designTokenOwnedCssFiles` with:

```ts
"pages/Search/Search.module.css",
"pages/Wishlist/Wishlist.module.css",
"pages/Profile/Profile.module.css",
"features/accommodations/components/AccommodationBookingCard.module.css",
"features/accommodations/components/AccommodationHero.module.css",
"features/accommodations/components/AccommodationReviewsSection.module.css",
"features/accommodations/components/AccommodationDescriptionModal.module.css",
"features/accommodations/components/AccommodationImageGalleryModal.module.css",
```

- [x] **Step 2: Add breakpoint allow-list test**

Add this test to `tokens.test.ts`:

```ts
const allowedBreakpointValues = new Set([
  "480px",
  "768px",
  "769px",
  "1024px",
  "1025px",
  "1200px",
  "1400px",
]);

it("keeps media query breakpoints on the agreed pre-design scale", () => {
  const offenders = collectProductionContractFiles(srcDir)
    .filter((filePath) => filePath.endsWith(".css"))
    .flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8");

      return source.split(/\r?\n/).flatMap((line, index) => {
        const matches = Array.from(line.matchAll(/@media[^{]*?(\d+px)/g));

        return matches
          .filter((match) => !allowedBreakpointValues.has(match[1]))
          .map(
            (match) =>
              `${path.relative(process.cwd(), filePath)}:${index + 1}: ${match[1]}`
          );
      });
    });

  expect(offenders).toEqual([]);
});
```

- [x] **Step 3: Add local z-index literal test for high-impact CSS**

Add a test that scans only `designTokenOwnedCssFiles` for:

```ts
/z-index\s*:\s*(?:10|100)\b/
```

Expected allowed values inside these files are `var(--z-*)`, `calc(var(--z-*) + 1)`, `1`, and `0` only.

- [x] **Step 4: Run token test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/styles/tokens.test.ts --runInBand
```

Expected: FAIL with concrete raw color/radius/shadow/breakpoint/z-index offenders.

- [x] **Step 5: Fix offenders without visual redesign**

Use existing tokens only:
- `#222222` → `var(--color-text-primary)`
- `#717171` → `var(--color-text-secondary)`
- `#ffffff`/`white` → `var(--color-background-page)` or `var(--color-text-inverse)` by context
- `#f7f7f7` → `var(--color-background-muted)`
- `#dddddd` → `var(--color-border-default)`
- `#b0b0b0` → `var(--color-border-strong)`
- `#ff385c` → `var(--color-brand-coral)`
- `#e61e4d` → `var(--color-brand-coral-hover)`
- `4px`, `8px`, `12px`, `50%` radius → `var(--radius-sm|md|lg|pill)`
- high overlay z-index → matching `var(--z-*)`
- local stack z-index → `1` only when it is inside an already positioned component.

For breakpoints:
- `700px` → `768px`
- `1100px` → `1200px`
- Keep `769px` and `1025px` only for `min-width` companion media queries.

- [x] **Step 6: Run token test and verify it passes**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/styles/tokens.test.ts --runInBand
```

Expected: PASS.

---

### Task 4: Browser QA With GStack

**Files:**
- QA output: `.gstack/qa-reports/`
- No source edits unless QA finds a reproducible bug.

- [x] **Step 1: Evaluate the clean checkpoint requirement before gstack QA**

Because gstack `/qa` requires a clean worktree for atomic fix commits, first split the current work into logical commits or stash all uncommitted work.

Actual result: full `/qa` was not run because the worktree contains the accumulated Phase 2-8 refactor changes and the user did not explicitly request commits/stash. To avoid mutating git history, this phase used gstack `qa-only` report mode instead.

Recommended commit groups:

```bash
git status --short
git add docs/superpowers/plans/*.md
git commit -m "docs: record frontend structural refactor plans"

git add src/shared/ui/Dialog src/shared/ui/useBodyScrollLock.ts src/shared/ui/useBodyScrollLock.test.tsx src/shared/ui/shared-ui-boundary-contracts.test.ts
git commit -m "refactor(ui): centralize dialog overlay primitive"

git add src/features/reviews/components/ReviewModal src/features/accommodations/components/AccommodationActionModal src/components/components-boundary-contracts.test.ts src/styles/tokens.test.ts
git commit -m "refactor(modals): migrate feature modals to dialog primitive"

git add src/features/search/components/SearchMap
git commit -m "refactor(search): split map sdk side effects into hooks"
```

Do not run `git add -A`; stage only intentional files. If unrelated dirty files remain, do not include them.

- [x] **Step 2: Start the app**

Run:

```bash
npm start
```

Expected: local app available at `http://localhost:3000`. If port 3000 is occupied, use the port printed by CRA.

Actual result: CRA served the app at `http://localhost:3002`.

- [x] **Step 3: Run gstack QA report-only quick scope**

Run gstack QA in quick/diff-aware browser mode against:

```text
Target URL: http://localhost:3000
Tier: quick
Scope: Search page, map markers/InfoWindow, accommodation detail image gallery, ReviewModal, AccommodationActionModal, auth/reservation/wishlist modals smoke
```

Expected: QA report under `.gstack/qa-reports/` with screenshots and console summary.

Actual result: report-only browser QA was written to `.gstack/qa-reports/qa-report-localhost-3002-2026-07-03-phase8.md`, with screenshots under `.gstack/qa-reports/screenshots/phase8-*`.

- [x] **Step 4: Fix only reproducible high/critical QA bugs**

If QA finds a bug:
- Add or update a regression test closest to the bug.
- Apply the smallest source fix.
- Re-run the failing test and impacted focused tests.
- Re-run the specific browser repro.

Do not use QA time to redesign visuals.

Actual result: no high/critical source regression was found in the Phase 8 flows. Deferred findings were environment/auth-state issues: Google Maps referer/embed authorization and unauthenticated `/auth/me` 401 console noise.

---

### Task 5: Final Verification and Handoff

**Files:** no additional source files unless earlier tasks require fixes.

- [x] **Step 1: Run focused suites**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/styles/tokens.test.ts src/components/components-boundary-contracts.test.ts src/shared/ui/shared-ui-boundary-contracts.test.ts src/features/accommodations/components/AccommodationImageGalleryModal.test.tsx src/features/search/components/SearchMap/SearchMapStructure.test.ts --runInBand
```

Expected: PASS.

- [x] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npm run test:ci:no-cache -- --runInBand
npm run build
```

Expected: PASS.

- [x] **Step 3: Update final architecture closure note**

Append a short dated note to `docs/superpowers/plans/2026-07-03-airbob-final-architecture-closure.ko.md`:

```md
## 2026-07-03 Phase 8 Pre-Design Closure

- Removed unreferenced generic custom modals or migrated any surviving modal use to feature-owned boundaries.
- Stabilized fullscreen gallery overlay accessibility and token usage.
- Expanded token, z-index, and breakpoint contracts for high-impact pre-design screens.
- Ran gstack QA quick scope for search/map/detail/modal flows.
- Verification: typecheck, full Jest, build, and QA report path.
```

---

## Self-Review

- Spec coverage: This plan covers the remaining items that were not inside Phase 6/7: browser QA, leftover overlay decisions, high-impact token/breakpoint/z-index sweep, and commit grouping.
- Placeholder scan: No task uses `TBD`, generic “fix later”, or undefined files. Every command has an expected result.
- Type consistency: Modal names, file paths, and token names match the current codebase and `tokens.css`.
