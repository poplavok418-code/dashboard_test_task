---
name: version-feature-loop
description: End-to-end project workflow for this Mail_test_task repo. Use when the user describes a next feature set/version and wants Codex to create a versioned spec, automated tests and fixtures, implement code under versions, run tests, fix failures without changing the spec, and produce a final implementation/test report. Trigger on requests such as "build the next version", "create spec/tests/implementation for this feature set", "run the whole loop", or "$version-feature-loop".
---

# Version Feature Loop

## Required Input

Require a version folder name in `number_release_name` form, for example `02_sheet_ingestion`.
If the user does not provide one, ask for it before creating files.

Use these versioned paths:

- Spec: `specs/<version>/`
- Tests: `tests/<version>/`
- Test fixtures: `tests/<version>/test_cases/`
- Implementation: `versions/<version>/`
- Report: `specs/<version>/implementation_report.md`

Do not put fixtures for a new version into `tests/01_basic_page/test_cases/` unless the version is `01_basic_page` or the user explicitly asks to reuse that folder.

## Previous-Version Baseline

Treat the latest earlier release as the baseline for each new version unless the user explicitly asks for a clean rewrite or a different source version.

- Identify the latest previous version by numeric prefix, for example `02_input_preprocessing` is the baseline for `03_visualization_choice`.
- Start the new implementation by copying or extending the previous version's app, tests, fixtures, configuration, and behavior that are still relevant.
- Preserve working user flows from the baseline, then add the next logical layer requested for the new version.
- In the new spec, explicitly state which baseline behavior is inherited and which behavior is newly added, changed, or intentionally removed.
- Add regression tests for inherited baseline behavior that the new feature depends on.
- Keep the new version self-contained under `versions/<version>/`; do not mutate previous version folders unless the user asks for a shared fix.

## Quick Workflow

1. Clarify missing version name or essential feature ambiguity only.
2. Read project context: `specs/Project Description.md`, `specs/project_description.md` if present, `specs/technical_spec.md`, and any issue/spec files directly relevant to the requested feature.
3. Inspect previous version folders in `versions/`, `tests/`, and `specs/`; identify the latest previous version and use it as the baseline unless directed otherwise.
4. Create the new feature spec before implementation. Keep it concrete, testable, Russian UI oriented, scoped to the requested version, and clear about inherited baseline behavior versus new behavior.
5. Create automated tests and fixtures before or alongside implementation. Tests must encode the spec and include stable selectors/contracts.
6. Implement the feature in `versions/<version>/` by starting from the previous version baseline and layering the requested new capability on top.
7. Run type/build checks and the generated test script. Also run existing relevant tests when the new code depends on earlier behavior.
8. If tests fail, diagnose from logs/screenshots/artifacts, edit only implementation/test-harness bugs as appropriate, document the fix in the report, and rerun. Do not change the spec to make failures disappear.
9. When tests pass, write `specs/<version>/implementation_report.md` and summarize results to the user.

Read `references/workflow-checklist.md` when starting this skill.

## Spec Rules

The spec must include:

- Goal and out-of-scope items.
- User-facing behavior and Russian UI text expectations.
- Data contracts and validation rules.
- Component or module plan.
- Acceptance criteria.
- Manual and automated test cases.
- Known limits/tradeoffs for this version.

The spec is the contract. After tests begin failing, do not weaken or rewrite the spec unless the user explicitly changes requirements.

## Test Rules

Put tests under `tests/<version>/` and fixtures under `tests/<version>/test_cases/`.

Prefer Playwright tests for visible UI behavior. Add unit tests when the feature has important pure utilities. Include a version-local runner script such as:

- `tests/<version>/run_<version>_tests.ps1`

Tests should cover:

- Primary happy paths.
- Rejection/error paths.
- Boundary limits.
- Regression coverage for previous behavior reused by the new version.
- A backend/privacy guard when raw uploaded data must stay client-side.

Use stable `data-testid` hooks in the implementation when UI tests need them.

## Implementation Rules

Store code in `versions/<version>/`.

Default to copying the latest previous version into the new version folder before implementing the new layer. Remove or change inherited behavior only when the new spec says to do so.

Keep the implementation aligned with the repo stack unless the spec says otherwise:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Russian frontend copy.
- Browser-first data handling where practical.

Avoid changing previous version folders unless the user requests a shared fix. Copy deliberately and keep the new version self-contained.

## Failure Loop

For each failed test run:

1. Record failed test names and short error causes.
2. Inspect implementation and test assumptions.
3. Fix the implementation when behavior violates the spec.
4. Fix the test only when the test incorrectly represents the spec or has a harness/path issue.
5. Add a short note to the report under "Issues And Fixes".
6. Rerun until all version tests pass or a true external blocker remains.

## Final Report

Write `specs/<version>/implementation_report.md` with:

- Implemented features.
- Files/folders created.
- Test commands run.
- Total tests, passed, failed.
- Failed tests and fixes, if any.
- Known limitations and next-step suggestions.

Final user response should be concise and include the same pass/fail numbers.
