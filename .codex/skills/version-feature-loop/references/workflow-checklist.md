# Version Feature Loop Checklist

Use this checklist while executing `$version-feature-loop`.

## Before Writing

- Confirm `version` in `number_release_name` format.
- Read current project specs.
- Inspect existing version/test folder conventions.
- Identify the latest previous version by numeric prefix.
- Treat that previous version as the baseline unless the user explicitly asks for a clean rewrite or a different source version.
- List which baseline behaviors should be inherited, changed, removed, and newly layered into the next release.

## Artifact Layout

- `specs/<version>/<feature>_spec.md`
- `tests/<version>/<feature>.spec.ts`
- `tests/<version>/run_<version>_tests.ps1`
- `tests/<version>/test_cases/`
- `versions/<version>/`
- `specs/<version>/implementation_report.md`

## Spec Checklist

- Goal.
- Scope and out of scope.
- Baseline version and inherited behavior.
- New, changed, and intentionally removed behavior.
- UI language requirements.
- User flows.
- Data contracts.
- Validation/error rules.
- Component/module plan.
- Acceptance criteria.
- Automated test matrix.
- Manual test cases.
- Future handoff notes.

## Test Checklist

- Tests can run from the repository root.
- Runner script sets any required base URL/path environment variables.
- Fixtures are small and committed under `test_cases`.
- UI tests use stable `data-testid` selectors.
- Regression tests cover inherited baseline behavior needed by the new version.
- Tests include at least one negative/error case per major validation rule.
- Tests include privacy/backend guards when relevant.

## Implementation Checklist

- Code lives in `versions/<version>`.
- Start from the latest previous version baseline, then layer the new feature on top.
- User-facing frontend copy is Russian.
- No raw stack traces in the UI.
- No unrelated refactors in older versions.
- Build/typecheck passes before browser tests when applicable.

## Report Checklist

- Include exact commands.
- Include total/pass/fail counts.
- List failed tests by name if any failed at any point.
- Explain implementation fixes made after failing tests.
- Mention unrun checks and why, if any.
