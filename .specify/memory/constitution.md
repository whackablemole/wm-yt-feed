<!--
Sync Impact Report
==================
Version change: [TEMPLATE, unratified] → 1.0.0
Bump rationale: Initial ratification of the project constitution — first
  time concrete principles replace the placeholder template, so this is
  treated as MAJOR (1.0.0) per semantic-versioning-for-governance-docs
  convention, not an incremental amendment.

Modified principles: N/A (initial adoption; no prior named principles existed)

Added sections:
  - I. Discord-Native, Single-Purpose Bot
  - II. Containerized, Portable Deployment
  - III. Strict Static Typing (NON-NEGOTIABLE)
  - IV. Raspberry-Pi-Class Resource Discipline
  - V. Operational Simplicity
  - Technology Constraints
  - Development Workflow
  - Governance

Removed sections: Generic placeholder template sections (no named principles
  existed to remove or rename)

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate is
    generic ("[Gates determined based on constitution file]") and reads the
    constitution at plan time; no edits needed.
  - ✅ .specify/templates/spec-template.md — no constitution-specific
    references; remains technology-agnostic by design; no edits needed.
  - ✅ .specify/templates/tasks-template.md — no constitution-specific
    references; task categorization is already generic enough to accommodate
    the new principles (setup/foundational/polish phases can carry
    typing/container/lightweight tasks without template changes).
  - ✅ Command files under .specify/ — no agent-specific (e.g. CLAUDE-only)
    references found requiring updates.
  - ✅ specs/001-discord-youtube-bot/plan.md — pre-dated this ratification;
    Constitution Check section re-run against v1.0.0 and updated in place.
    All five principles pass without changes to the plan's technical
    choices (TypeScript strict mode, multi-arch Docker including arm64,
    embedded SQLite were already aligned).

Follow-up TODOs: None outstanding.
-->

# wm-yt-feed Constitution

## Core Principles

### I. Discord-Native, Single-Purpose Bot

The application exists to monitor YouTube channels and post updates into
Discord; it MUST NOT grow a general-purpose web UI, admin dashboard, or
unrelated integrations. All user-facing configuration and output happens
through Discord itself (slash commands and posted messages). Any capability
that isn't in service of "watch YouTube channels, post to Discord channels"
belongs in a different project.

**Rationale**: A narrow, well-defined scope is what makes the lightweight,
single-container deployment (Principles II and IV) achievable. Scope creep
into a web UI or multi-purpose platform would directly conflict with the
resource and simplicity constraints below.

### II. Containerized, Portable Deployment

The application MUST ship and run as an OCI-compliant container image, with
all runtime configuration supplied via environment variables (no
host-specific setup steps, no imperative install scripts required on the
host beyond running the container). Container images MUST be built for
multiple architectures, and `linux/arm64` MUST always be a first-class
build target, not an optional add-on.

**Rationale**: Containerization is a direct project requirement, and the
Raspberry Pi deployment target (Principle IV) means the ARM build is not
optional — if it's ever dropped from the build matrix by omission, the
project has silently broken its own deployment target.

### III. Strict Static Typing (NON-NEGOTIABLE)

The implementation language MUST be statically and strictly typed, and the
type checker MUST be run with its strictest practical settings enabled
(e.g., TypeScript's `strict` compiler mode). Use of untyped escape hatches
(e.g., `any`, unchecked casts, `// @ts-ignore`) is disallowed except with an
inline comment explaining why no typed alternative exists; such exceptions
MUST remain rare. All boundaries the application crosses — Discord command
options, database rows, and parsed external data (e.g., YouTube feed
entries) — MUST be represented by explicit types, not loosely-typed
objects.

**Rationale**: This is a solo-maintained, self-hosted bot with no dedicated
QA process. Strict typing is the primary lever for catching mistakes before
they reach a running Raspberry Pi, and for making bugs traceable quickly
when they do occur — directly serving the "easy debugging" requirement this
principle exists for.

### IV. Raspberry-Pi-Class Resource Discipline

The application MUST run reliably within the constraints of low-power,
ARM-based home-lab hardware (indicative budget: well under 256MB RAM and a
fraction of a single CPU core at idle/typical load). Every added runtime
dependency, background process, or additional container/service MUST be
justified against this budget before being introduced. Preference order for
any new capability: (1) no new dependency, (2) an embedded/in-process
library, (3) a separate lightweight service, in that order — the heavier
option requires explicit justification for why the lighter ones don't work.

**Rationale**: This is an explicit, non-negotiable hardware target from the
project's outset. Unlike a cloud-hosted service, there's no "just scale the
instance" fallback — a design that assumes generous resources will simply
fail to run where it's meant to run.

### V. Operational Simplicity

The deployed system MUST remain operable by a single person with minimal
ongoing maintenance: prefer one container over many, prefer embedded storage
over a separate database service, and prefer configuration via a small
number of environment variables over external config services. Complexity
(additional services, processes, or moving parts) MUST be justified by a
concrete requirement the simpler alternative cannot meet — not by
anticipated future needs.

**Rationale**: This reinforces Principles II and IV in practice: a
one-container, embedded-storage deployment is both easier to run on a
Raspberry Pi and easier for a single maintainer to reason about when
something breaks.

## Technology Constraints

- **Language & typing**: A statically, strictly typed language is required
  (Principle III). TypeScript in strict mode on a current Node.js LTS is the
  default choice for this project; any deviation must still satisfy
  Principle III's typing guarantees.
- **Containerization**: Docker (or an OCI-compatible equivalent) with
  multi-architecture builds including `linux/arm64` (Principle II).
- **Storage**: Prefer an embedded, file-based datastore (e.g., SQLite) over
  a separate database service unless a specific, documented requirement
  exceeds what an embedded store can provide (Principles IV and V).
- **Dependencies**: Favor small, well-maintained libraries with low runtime
  footprint over large frameworks; evaluate new dependencies against
  Principle IV's resource budget before adding them.

## Development Workflow

- Every change that touches typed source code MUST pass the project's
  strict type check with zero errors before merge (enforces Principle III).
- Every change that affects the container image MUST be validated (built
  and, where practical, run) for the `linux/arm64` target, not only the
  developer's native architecture (enforces Principle II and IV).
- Code review (self-review is acceptable for a solo maintainer, but MUST be
  a deliberate, separate pass from initial implementation) MUST check new
  code against these principles before merge, particularly new dependencies
  or services against Principle V's simplicity bar.
- Documentation (plans, specs, READMEs) that describes the running system
  MUST stay consistent with what's actually deployed; stale docs that
  contradict the deployed container are treated as a bug.

## Governance

This constitution supersedes any conflicting informal practice for this
project. Amendments are made by editing this file directly, following the
same process used to create it: identify the concrete change, determine the
correct semantic version bump (MAJOR for removing/redefining a principle in
a backward-incompatible way, MINOR for adding a principle or materially
expanding guidance, PATCH for wording/clarification fixes), update the
Sync Impact Report at the top of this file, and update `LAST_AMENDED_DATE`
below.

Every feature plan MUST include a Constitution Check section that verifies
the plan's technical choices against the principles above before Phase 0
research begins, and MUST re-verify after Phase 1 design. Any violation
must be recorded in that plan's Complexity Tracking table with a concrete
justification — "we didn't check" is not an acceptable justification, and
an unresolved violation blocks the plan from proceeding.

**Version**: 1.0.0 | **Ratified**: 2026-09-28 | **Last Amended**: 2026-09-28
