# Airbob Overlay Primitive Stabilization Phase 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Dialog`를 단일 overlay primitive로 확장하고, `ReviewModal`과 `AccommodationActionModal`을 custom overlay에서 `Dialog` 기반으로 이관한다.

**Architecture:** `shared/ui/Dialog`가 focus trap, Escape, backdrop close, scroll lock, accessible naming, size/body padding policy를 소유한다. Feature modal은 도메인 UI와 action만 소유하고 overlay shell, z-index, body scroll lock을 직접 구현하지 않는다. `SearchMap` 분해와 광범위 breakpoint 정리는 별도 Phase로 분리해 modal 이관 회귀와 섞지 않는다.

**Tech Stack:** React 19, TypeScript 4.9, CSS Modules, React Testing Library, Jest.

---

## File Structure

- Modify: `src/shared/ui/Dialog/Dialog.tsx`
  - `size`, `showHeader`, `closeButtonLabel`, `closeOnBackdrop`, `bodyPadding` props를 추가한다.
  - header가 보이는 경우 `aria-labelledby`, header가 숨겨진 경우 `aria-label`을 사용한다.
- Modify: `src/shared/ui/Dialog/Dialog.module.css`
  - dialog size variant와 body padding variant를 추가한다.
- Modify: `src/shared/ui/Dialog/Dialog.test.tsx`
  - headerless mode, backdrop opt-out, size/body padding variant contract를 검증한다.
- Modify: `src/features/reviews/components/ReviewModal/ReviewModal.tsx`
  - `useBodyScrollLock`와 custom overlay shell을 제거하고 `Dialog`를 사용한다.
- Modify: `src/features/reviews/components/ReviewModal/ReviewModal.module.css`
  - overlay/modal shell CSS를 Dialog body/dialog class로 재정렬하고 core token literal을 줄인다.
- Create: `src/features/reviews/components/ReviewModal/ReviewModal.test.tsx`
  - dialog semantics, close behavior, sorting behavior를 검증한다.
- Modify: `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.tsx`
  - `useBodyScrollLock`와 custom overlay shell을 제거하고 `Dialog`를 사용한다.
- Modify: `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.module.css`
  - overlay/modal shell CSS를 Dialog body/dialog class로 재정렬한다.
- Create: `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.test.tsx`
  - dialog semantics, edit/detail navigation, action buttons를 검증한다.
- Modify: `src/shared/ui/shared-ui-boundary-contracts.test.ts`
  - design-entry modal은 `useBodyScrollLock`만으로 통과하지 못하고 `<Dialog`를 사용해야 한다.
- Modify: `src/styles/tokens.test.ts`
  - 이관된 modal CSS가 기존 design-owned token gate에 계속 걸리도록 유지한다.

---

### Task 1: Extend Dialog Primitive

**Files:**
- Modify: `src/shared/ui/Dialog/Dialog.tsx`
- Modify: `src/shared/ui/Dialog/Dialog.module.css`
- Modify: `src/shared/ui/Dialog/Dialog.test.tsx`

- [x] **Step 1: Add failing tests**

Add tests to `Dialog.test.tsx`:

```tsx
it("supports headerless dialogs with an accessible aria-label", () => {
  render(
    <Dialog isOpen title="후기 2개" onClose={jest.fn()} showHeader={false}>
      <button type="button" autoFocus>
        후기 닫기
      </button>
      content
    </Dialog>
  );

  expect(screen.getByRole("dialog", { name: "후기 2개" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "후기 2개" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "후기 닫기" })).toHaveFocus();
});

it("can disable backdrop close for modal workflows that require explicit actions", async () => {
  const onClose = jest.fn();
  render(
    <Dialog isOpen title="예약 확인" onClose={onClose} closeOnBackdrop={false}>
      content
    </Dialog>
  );

  await userEvent.click(screen.getByRole("presentation"));

  expect(onClose).not.toHaveBeenCalled();
});

it("applies size and body padding variants", () => {
  render(
    <Dialog
      isOpen
      title="후기"
      onClose={jest.fn()}
      size="xl"
      bodyPadding="none"
    >
      content
    </Dialog>
  );

  expect(screen.getByRole("dialog", { name: "후기" }).className).toContain("sizeXl");
  expect(screen.getByText("content").parentElement?.className).toContain("bodyPaddingNone");
});
```

- [x] **Step 2: Run focused test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/shared/ui/Dialog/Dialog.test.tsx --runInBand
```

Expected: FAIL because the new props do not exist yet.

- [x] **Step 3: Implement Dialog props**

Implement these public types in `Dialog.tsx`:

```ts
export type DialogBodyPadding = "default" | "none";
export type DialogSize = "sm" | "md" | "lg" | "xl" | "fullscreen";
```

Add props:

```ts
bodyPadding?: DialogBodyPadding;
closeButtonLabel?: string;
closeOnBackdrop?: boolean;
showHeader?: boolean;
size?: DialogSize;
```

Use `React.useId()` for the title id, apply `aria-labelledby` only when header is shown, and keep `aria-label={title}` for headerless dialogs.

- [x] **Step 4: Implement CSS variants**

Add classes to `Dialog.module.css`:

```css
.sizeSm { max-width: 400px; }
.sizeMd { max-width: 560px; }
.sizeLg { max-width: 800px; }
.sizeXl { max-width: 1200px; }
.sizeFullscreen {
  width: calc(100vw - 48px);
  max-width: none;
  height: calc(100dvh - 48px);
  max-height: calc(100dvh - 48px);
}
.bodyPaddingNone { padding: 0; }
```

Keep `.dialog` on `position: relative` so feature modal close buttons can be positioned inside the shared shell.

- [x] **Step 5: Run focused test and verify it passes**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/shared/ui/Dialog/Dialog.test.tsx --runInBand
```

Expected: PASS.

---

### Task 2: Migrate ReviewModal to Dialog

**Files:**
- Modify: `src/features/reviews/components/ReviewModal/ReviewModal.tsx`
- Modify: `src/features/reviews/components/ReviewModal/ReviewModal.module.css`
- Create: `src/features/reviews/components/ReviewModal/ReviewModal.test.tsx`

- [x] **Step 1: Add tests**

Create `ReviewModal.test.tsx` with tests that:

```tsx
expect(screen.getByRole("dialog", { name: "후기 2개" })).toBeInTheDocument();
await userEvent.click(screen.getByRole("button", { name: "후기 모달 닫기" }));
await userEvent.keyboard("{Escape}");
await userEvent.click(screen.getByRole("button", { name: "최신순" }));
await userEvent.click(screen.getByRole("button", { name: "낮은 평점순" }));
```

Use two reviews with ratings 5 and 1 so sorting can be asserted by DOM order.

- [x] **Step 2: Run focused test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reviews/components/ReviewModal/ReviewModal.test.tsx --runInBand
```

Expected: FAIL because the close button is not labelled as `후기 모달 닫기` and the component does not use `Dialog` semantics yet.

- [x] **Step 3: Replace custom shell with Dialog**

In `ReviewModal.tsx`:
- Replace `useBodyScrollLock` import with `Dialog`.
- Remove the custom overlay and modal wrapper.
- Render:

```tsx
<Dialog
  isOpen={isOpen}
  title={`후기 ${totalCount}개`}
  onClose={onClose}
  showHeader={false}
  size="xl"
  bodyPadding="none"
  className={styles.dialog}
  bodyClassName={styles.modalContent}
>
  <button type="button" className={styles.closeButton} onClick={onClose} autoFocus aria-label="후기 모달 닫기">
    ...
  </button>
  ...
</Dialog>
```

- [x] **Step 4: Update CSS**

Remove `.overlay` and `.modal` shell ownership. Add `.dialog` for width/height and keep `.modalContent` as the scrollable content surface. Replace `#fafafa`, `#ebebeb`, `#222222`, `#DDD`, and raw shadows with existing tokens.

- [x] **Step 5: Run focused tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/reviews/components/ReviewModal/ReviewModal.test.tsx src/shared/ui/Dialog/Dialog.test.tsx src/styles/tokens.test.ts --runInBand
```

Expected: PASS.

---

### Task 3: Migrate AccommodationActionModal to Dialog

**Files:**
- Modify: `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.tsx`
- Modify: `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.module.css`
- Create: `src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.test.tsx`

- [x] **Step 1: Add tests**

Create `AccommodationActionModal.test.tsx` that verifies:

```tsx
expect(screen.getByRole("dialog", { name: "숙소 관리" })).toBeInTheDocument();
await userEvent.click(screen.getByRole("button", { name: "숙소 관리 닫기" }));
await userEvent.click(screen.getByRole("button", { name: "리스팅 수정" }));
await userEvent.click(screen.getByText("남산 숙소"));
await userEvent.click(screen.getByRole("button", { name: "리스팅 비공개" }));
```

Mock `useNavigate`, `useAccommodationActions`, `getImageUrl`, and `ErrorToast`.

- [x] **Step 2: Run focused test and verify it fails**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.test.tsx --runInBand
```

Expected: FAIL because the close button is not labelled and custom shell does not expose Dialog semantics.

- [x] **Step 3: Replace custom shell with Dialog**

In `AccommodationActionModal.tsx`:
- Replace `useBodyScrollLock` import with `Dialog`.
- Remove custom overlay/modal shell.
- Render `Dialog` with `title="숙소 관리"`, `showHeader={false}`, `size="sm"`, `bodyPadding="none"`, and a custom close button labelled `숙소 관리 닫기`.

- [x] **Step 4: Update CSS**

Remove `.overlay` and `.modal` shell ownership. Add `.dialog` for max width if needed and keep `.content` as the padded modal body.

- [x] **Step 5: Run focused tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.test.tsx src/shared/ui/Dialog/Dialog.test.tsx src/styles/tokens.test.ts --runInBand
```

Expected: PASS.

---

### Task 4: Tighten Overlay Boundary Contract

**Files:**
- Modify: `src/shared/ui/shared-ui-boundary-contracts.test.ts`

- [x] **Step 1: Tighten the test**

Change the design-entry modal contract so `hasSharedScrollBoundary` becomes:

```ts
const usesDialog = source.includes("<Dialog");

if (!usesDialog) {
  fileViolations.push(`${relativePath}: missing shared Dialog primitive`);
}
```

Keep the existing `document.body.style.overflow` violation.

- [x] **Step 2: Run focused boundary tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/shared/ui/shared-ui-boundary-contracts.test.ts src/components/components-boundary-contracts.test.ts --runInBand
```

Expected: PASS.

---

### Task 5: Verification

**Files:** no additional files.

- [x] **Step 1: Run targeted tests**

Run:

```bash
npm run test:ci:no-cache -- --runTestsByPath src/shared/ui/Dialog/Dialog.test.tsx src/features/reviews/components/ReviewModal/ReviewModal.test.tsx src/features/accommodations/components/AccommodationActionModal/AccommodationActionModal.test.tsx src/shared/ui/shared-ui-boundary-contracts.test.ts src/styles/tokens.test.ts --runInBand
```

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 3: Run full Jest**

Run:

```bash
CI=true npm run test:ci:no-cache -- --runInBand
```

Expected: PASS.

- [x] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

---

## Self-Review

- Spec coverage: This phase covers Dialog primitive expansion and two highest-priority custom modal migrations. It also tightens the overlay boundary contract so future design-entry modals cannot pass with only manual scroll lock. `SearchMap` decomposition and broad breakpoint cleanup remain intentionally out of scope for Phase 7 because they are independent high-risk subsystems.
- Placeholder scan: No placeholder tasks remain; each task has exact files, commands, and expected outcomes.
- Type consistency: `DialogSize`, `DialogBodyPadding`, `showHeader`, `closeOnBackdrop`, and `bodyPadding` are consistently referenced across tasks.
