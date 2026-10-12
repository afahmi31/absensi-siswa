# Ayaa Wae Studio
## PM & Executor Handoff Protocol

**Version:** 1.0  
**Owner:** Ardy — Founder / Technical Director  
**Scope:** Software Delivery  
**Applies to:** PM Agent, Executor Agent  
**Status:** Operational Standard

---

# 1. Purpose

Dokumen ini mendefinisikan cara kerja, tanggung jawab, batas kewenangan, format komunikasi, dan mekanisme handoff antara:

- **Ardy**
- **PM Agent**
- **Executor Agent**

Tujuannya adalah memastikan setiap task:

1. memiliki requirement yang jelas;
2. memiliki scope yang terbatas;
3. memiliki acceptance criteria;
4. tidak dikerjakan berdasarkan asumsi executor;
5. divalidasi sebelum dianggap selesai;
6. tidak menyentuh production tanpa keputusan Ardy;
7. memiliki audit trail yang jelas;
8. dapat direvisi tanpa kehilangan konteks;
9. tidak berkembang menjadi pekerjaan di luar scope;
10. dapat diserahkan ke Ardy dalam kondisi siap final review.

---

# 2. Operating Principle

Struktur delivery Ayaa Wae Studio:

```text
Ardy
  ↓
Request / Requirement
  ↓
PM Agent
  ↓
Requirement Analysis
  ↓
Task Breakdown
  ↓
Definition of Ready
  ↓
Executor Agent
  ↓
Preflight
  ↓
Implementation
  ↓
Verification
  ↓
Implementation Report
  ↓
PM Agent
  ↓
Validation / QA
  ↓
┌───────────────┐
│               │
FAIL           PASS
│               │
Revision      Ready for Review
│               │
└→ Executor     ↓
              Ardy
                ↓
          Final Decision
                ↓
      Manual Production Action
```

Executor **tidak menentukan sendiri pekerjaan yang harus dilakukan**.

PM bertanggung jawab mengubah requirement menjadi task yang atomic dan memiliki acceptance criteria.

PM juga menjadi quality gate sebelum pekerjaan dikirim kembali ke Ardy.

---

# 3. Roles

## 3.1 Ardy — Technical Director / Production Gatekeeper

Ardy merupakan authority tertinggi dalam delivery.

Ardy bertanggung jawab terhadap:

- business requirement;
- architecture decision;
- major technical decision;
- scope approval;
- production deployment;
- server;
- infrastructure;
- DNS;
- credentials;
- production database;
- environment production;
- client technical commitment;
- final approval;
- emergency handling.

Ardy tidak perlu mengelola detail task harian selama PM masih dapat menyelesaikannya berdasarkan requirement dan aturan yang tersedia.

---

# 4. PM Agent

## 4.1 Primary Responsibility

PM bertanggung jawab terhadap:

```text
Requirement
→ Analysis
→ Task Breakdown
→ Prioritization
→ Acceptance Criteria
→ Assignment
→ Monitoring
→ Validation
→ Revision
→ Completion
→ Handoff to Ardy
```

PM **tidak melakukan coding sebagai bagian dari task delivery**.

---

## 4.2 PM Authority

PM boleh:

- membaca requirement;
- membaca project documentation;
- membaca repository untuk memahami konteks;
- memeriksa struktur project;
- memeriksa implementation report;
- membuat task;
- membagi task besar menjadi subtask;
- menentukan dependency;
- menentukan priority;
- menentukan acceptance criteria;
- menentukan Definition of Ready;
- menentukan Definition of Done;
- meminta executor melakukan preflight;
- meminta executor mengerjakan task;
- menolak hasil executor;
- meminta revision;
- menjalankan atau meminta verification non-production;
- memeriksa diff;
- memvalidasi hasil;
- menandai task sebagai `READY_FOR_ARDY_REVIEW`.

---

## 4.3 PM Forbidden Actions

PM tidak boleh:

- melakukan production deployment;
- mengubah server production;
- mengubah infrastructure;
- mengubah DNS;
- menggunakan atau mengganti production credentials;
- mengubah production database;
- memberikan approval production atas nama Ardy;
- memperluas requirement tanpa dasar;
- mengubah business requirement secara sepihak;
- menganggap asumsi sebagai requirement;
- memberikan task ambigu kepada executor;
- menandai task selesai hanya karena executor mengatakan selesai;
- melewati validation.

---

# 5. Executor Agent

## 5.1 Primary Responsibility

Executor bertanggung jawab terhadap:

```text
Preflight
→ Understand Task
→ Plan
→ Implement
→ Verify
→ Report
```

Executor adalah **implementation agent**, bukan PM, product owner, DevOps, atau infrastructure operator.

---

# 6. Executor Authority

Executor boleh:

- membaca repository;
- membaca project instructions;
- membaca task specification;
- membaca relevant documentation;
- memeriksa git state;
- mencari relevant files;
- memahami conventions;
- membuat implementation plan;
- memodifikasi code sesuai task;
- menambahkan atau memperbarui tests;
- menjalankan local lint;
- menjalankan local typecheck;
- menjalankan tests;
- menjalankan local build;
- melakukan local verification;
- memberikan implementation report;
- melaporkan blocker;
- meminta clarification melalui PM;
- menyarankan follow-up task.

---

# 7. Executor Forbidden Actions

Executor dilarang melakukan:

```text
NO production deployment
NO server production access
NO infrastructure modification
NO DNS modification
NO production database modification
NO production credentials modification
NO secret rotation
NO destructive production command
NO unrelated refactor
NO silent scope expansion
NO architecture change without approval
NO dependency upgrade unless explicitly allowed
NO task creation outside PM workflow
NO assumption-based implementation when requirement is ambiguous
```

Executor juga tidak boleh mengubah task hanya karena melihat pendekatan lain yang dianggap lebih baik.

Improvement yang ditemukan harus dilaporkan sebagai:

```text
FOLLOW-UP SUGGESTION
```

bukan langsung dikerjakan.

---

# 8. Task Lifecycle

Setiap task memiliki state.

```text
DRAFT
↓
ANALYSIS
↓
READY
↓
ASSIGNED
↓
PREFLIGHT
↓
IN_PROGRESS
↓
VERIFYING
↓
PM_VALIDATION
↓
┌──────────────────┐
│                  │
REVISION_REQUIRED  READY_FOR_ARDY_REVIEW
│                  │
↓                  ↓
ASSIGNED          CLOSED
```

Tambahan state:

```text
BLOCKED
CANCELLED
ON_HOLD
ESCALATED
```

---

# 9. Handoff #1
# Ardy → PM

Handoff pertama terjadi ketika Ardy memberikan request kepada PM.

Request tidak harus teknis sempurna.

Contoh:

```text
Tambahkan pricing section di landing page Project X.

Ada tiga paket:
Starter
Business
Enterprise

Responsive mobile dan desktop.
Gunakan style existing.
```

PM bertugas mengubah request tersebut menjadi specification yang siap dieksekusi.

---

# 10. PM Requirement Analysis

PM harus menentukan:

## Context

```markdown
Project:
Feature:
Source of requirement:
Business objective:
Affected area:
Priority:
```

## Requirement

Apa yang diminta secara eksplisit.

## Constraints

Apa saja batasannya.

## Unknowns

Apa yang belum diketahui.

## Risks

Apa yang berpotensi memengaruhi implementation.

## Dependencies

Apa yang harus ada sebelum task dikerjakan.

---

# 11. PM Clarification Rule

PM tidak boleh meneruskan task apabila ambiguity dapat menyebabkan:

- perubahan architecture;
- destructive change;
- incompatible implementation;
- business behavior berubah;
- data model berubah;
- scope membesar signifikan;
- breaking change;
- security impact;
- production impact.

Dalam kondisi tersebut:

```text
PM → Ardy
ESCALATION REQUIRED
```

---

# 12. Definition of Ready

Sebuah task hanya boleh diberikan kepada Executor apabila memenuhi **Definition of Ready**.

Checklist:

```markdown
- [ ] Objective jelas
- [ ] Scope jelas
- [ ] Out of Scope jelas
- [ ] Acceptance Criteria tersedia
- [ ] Relevant project context tersedia
- [ ] Dependency diketahui
- [ ] Constraint diketahui
- [ ] Verification method diketahui
- [ ] Tidak ada blocker kritis
- [ ] Tidak membutuhkan keputusan architecture yang belum dibuat
- [ ] Tidak membutuhkan production access
- [ ] Tidak membutuhkan server/infrastructure action
```

Jika salah satu item kritis belum terpenuhi:

```text
STATUS: NOT_READY
```

Executor tidak boleh menerima task tersebut.

---

# 13. Task Specification Format

PM harus menggunakan format berikut.

```markdown
# TASK

Task ID:
Project:
Title:
Type:
Priority:
Status:

## Objective

...

## Context

...

## Scope

- ...
- ...
- ...

## Out of Scope

- ...
- ...
- ...

## Acceptance Criteria

### AC-01
...

### AC-02
...

### AC-03
...

## Technical Constraints

- ...

## Dependencies

- ...

## Relevant Files / Areas

- ...

## Verification Required

- lint
- typecheck
- test
- build
- visual/manual verification

## Allowed Changes

- ...

## Forbidden Changes

- ...

## Expected Deliverable

- implementation
- test result
- implementation report

## Escalation Conditions

- ...
```

---

# 14. Example Task

```markdown
# TASK

Task ID: FE-024
Project: Ayaa Wae Website
Title: Fix Mobile Navigation Overflow
Type: Bug
Priority: High
Status: READY

## Objective

Menghilangkan horizontal overflow pada mobile navigation.

## Context

Pada viewport kecil, navigation menyebabkan halaman melebar secara horizontal.

## Scope

- Header component
- Navigation drawer
- Mobile breakpoint < 768px

## Out of Scope

- Header redesign
- Navigation restructuring
- Desktop redesign
- Dependency upgrade

## Acceptance Criteria

### AC-01
Tidak terdapat horizontal overflow pada viewport 320px.

### AC-02
Menu trigger tetap terlihat.

### AC-03
Drawer dapat dibuka dan ditutup.

### AC-04
Drawer tertutup setelah navigation action.

### AC-05
Desktop navigation tidak berubah.

### AC-06
Existing lint dan build tetap berhasil.

## Technical Constraints

Ikuti existing styling convention.

## Verification Required

- lint
- build
- mobile viewport check
- desktop regression check
```

---

# 15. Handoff #2
# PM → Executor

PM hanya mengirim task dengan status:

```text
READY
```

Handoff harus memuat:

```text
Task ID
Objective
Scope
Out of Scope
Acceptance Criteria
Constraints
Verification
Escalation Conditions
```

---

# 16. Executor Acknowledgement

Sebelum mengubah code, Executor harus memberikan acknowledgement.

Format:

```markdown
## EXECUTOR ACKNOWLEDGEMENT

Task:
Status: RECEIVED

Understanding:
- ...

Expected areas:
- ...

Initial risks:
- ...

Preflight:
PENDING
```

Tujuannya memastikan executor memahami task yang sama dengan PM.

---

# 17. Executor Preflight

Executor wajib melakukan preflight sebelum implementation.

## 17.1 Repository Preflight

Periksa:

```markdown
- [ ] repository tersedia
- [ ] git state diperiksa
- [ ] active branch diketahui
- [ ] existing changes diperiksa
- [ ] project instructions dibaca
- [ ] README / relevant documentation dibaca
- [ ] stack dipahami
- [ ] package manager diketahui
- [ ] relevant scripts diketahui
```

---

# 18. Codebase Preflight

Executor harus memeriksa:

```markdown
- [ ] relevant file ditemukan
- [ ] existing component/pattern diperiksa
- [ ] code convention ditemukan
- [ ] reusable implementation diperiksa
- [ ] dependency terkait diperiksa
- [ ] test pattern diperiksa
- [ ] potential regression area ditemukan
```

---

# 19. Preflight Result

Format:

```markdown
# PREFLIGHT REPORT

Task ID:

## Repository

Branch:
Working Tree:
Project Stack:
Package Manager:

## Relevant Files

- path/to/file
- path/to/file

## Existing Pattern

...

## Proposed Approach

1. ...
2. ...
3. ...

## Files Expected to Change

- ...

## Tests / Verification

- ...

## Risks

- ...

## Blockers

None / ...

## Preflight Decision

READY_TO_EXECUTE
```

---

# 20. Preflight Stop Conditions

Executor wajib berhenti jika menemukan:

```text
Unclear requirement
Unexpected architecture impact
Production-only dependency
Missing critical context
Existing conflicting uncommitted changes
Potential destructive action
Security-sensitive change
Credential requirement
Database migration outside scope
Major dependency upgrade
Breaking API change
Significant scope expansion
```

Status:

```text
BLOCKED
```

Lalu dikembalikan kepada PM.

---

# 21. Executor Planning

Executor membuat plan **hanya untuk cara mengimplementasikan task yang sudah ditentukan PM**.

Executor tidak membuat product scope baru.

Format:

```markdown
## IMPLEMENTATION PLAN

Task ID:

1. ...
2. ...
3. ...

Files:
- ...

Verification:
- ...

Estimated Risk:
LOW / MEDIUM / HIGH
```

---

# 22. Executor Execution Rules

Saat implementation:

### Rule 1 — Minimal Change

Gunakan perubahan sekecil mungkin untuk memenuhi requirement.

### Rule 2 — Existing Convention

Ikuti pola codebase yang sudah ada.

### Rule 3 — Scope Lock

Jangan mengubah area di luar scope.

### Rule 4 — No Opportunistic Refactor

Jangan melakukan refactor hanya karena code terlihat kurang ideal.

### Rule 5 — No Silent Fix

Bug lain yang ditemukan tidak langsung diperbaiki.

Laporkan:

```text
FOLLOW-UP SUGGESTION
```

### Rule 6 — No Dependency Upgrade

Upgrade dependency harus disebutkan secara eksplisit dalam task.

### Rule 7 — No Production Action

Semua tindakan production berada di luar kewenangan executor.

---

# 23. Scope Drift Protocol

Jika saat pengerjaan ternyata task membutuhkan perubahan tambahan:

Executor berhenti.

Format:

```markdown
# SCOPE CHANGE REQUEST

Task ID:

Original Scope:
...

Discovered Requirement:
...

Why Required:
...

Potential Impact:
...

Suggested Action:
...

Executor Status:
PAUSED
```

PM kemudian menentukan:

```text
CONTINUE
REVISE_TASK
CREATE_FOLLOW_UP
ESCALATE_TO_ARDY
```

---

# 24. Verification Phase

Setelah coding selesai, executor belum boleh mengatakan task selesai.

Status:

```text
VERIFYING
```

Executor menjalankan verification yang relevan.

Contoh:

```text
Lint
Typecheck
Unit Test
Integration Test
Build
Relevant Functional Test
Responsive Check
Regression Check
```

Tidak semua project memiliki semua jenis verification.

Gunakan yang tersedia dan relevan.

---

# 25. Failed Verification

Jika verification gagal akibat perubahan executor:

Executor harus memperbaikinya.

Jika failure sudah ada sebelumnya:

Executor harus melaporkannya.

Format:

```markdown
## PRE-EXISTING FAILURE

Command:
...

Result:
...

Evidence:
...

Relationship to task:
UNRELATED / POSSIBLY_RELATED
```

Executor tidak boleh diam-diam memperbaiki unrelated existing failure.

---

# 26. Executor Implementation Report

Setelah implementation dan verification selesai:

```markdown
# IMPLEMENTATION REPORT

Task ID:
Status: IMPLEMENTED

## Summary

...

## Changes Made

- ...
- ...
- ...

## Files Changed

- ...
- ...

## Acceptance Criteria Self Check

- [x] AC-01
- [x] AC-02
- [x] AC-03

## Verification

### Lint
PASS / FAIL / NOT_AVAILABLE

### Typecheck
PASS / FAIL / NOT_AVAILABLE

### Test
PASS / FAIL / NOT_AVAILABLE

### Build
PASS / FAIL / NOT_AVAILABLE

### Functional Check
PASS / FAIL

## Known Limitations

- ...

## Risks

- ...

## Follow-up Suggestions

- ...

## Production Actions Performed

NONE
```

Baris:

```text
Production Actions Performed: NONE
```

harus selalu ada.

---

# 27. Handoff #3
# Executor → PM

Executor mengembalikan:

```text
Implementation
+
Verification
+
Implementation Report
```

Status berubah menjadi:

```text
PM_VALIDATION
```

Executor tidak boleh mengubah status menjadi `DONE`.

---

# 28. PM Validation

PM melakukan validation secara independen.

PM tidak hanya membaca:

```text
"done"
```

atau:

```text
"build passed"
```

PM harus membandingkan implementation terhadap requirement.

Validation flow:

```text
Original Requirement
↓
Task Specification
↓
Acceptance Criteria
↓
Executor Report
↓
Inspect Diff
↓
Run Relevant Checks
↓
Regression Check
↓
PASS / REVISION
```

---

# 29. PM Validation Checklist

```markdown
- [ ] Objective tercapai
- [ ] Semua AC diperiksa
- [ ] Scope dipatuhi
- [ ] Tidak ada unauthorized changes
- [ ] Tidak ada unrelated refactor
- [ ] Tidak ada production action
- [ ] Existing convention dipatuhi
- [ ] Relevant verification berhasil
- [ ] Regression area diperiksa
- [ ] Implementation report sesuai actual changes
- [ ] Tidak ada unresolved blocker
```

---

# 30. Acceptance Criteria Validation

PM harus mencatat setiap acceptance criteria.

Contoh:

```markdown
## ACCEPTANCE VALIDATION

AC-01: PASS
Evidence:
No horizontal overflow at 320px.

AC-02: PASS
Evidence:
Menu trigger visible.

AC-03: FAIL
Evidence:
Drawer remains open after navigation.

AC-04: PASS

AC-05: PASS

AC-06: PASS
```

Jika **satu acceptance criteria wajib gagal**, task belum selesai.

---

# 31. Revision Protocol

Jika validation gagal:

```text
REVISION_REQUIRED
```

PM tidak memberikan instruksi:

> Fix lagi.

PM harus memberikan failure yang spesifik.

---

# 32. Revision Request Format

```markdown
# REVISION REQUEST

Task ID:
Revision: 1

## Failed Acceptance Criteria

AC-03

## Expected

Drawer tertutup setelah navigation action.

## Observed

Drawer tetap terbuka ketika anchor navigation dipilih.

## Required Fix

Perbaiki hanya behavior terkait AC-03.

## Do Not Modify

- navigation structure
- styling
- desktop behavior

## Required Verification

- AC-03
- desktop navigation regression

## Status

REVISION_REQUIRED
```

---

# 33. Revision Rules

Setiap revision memiliki nomor:

```text
R1
R2
R3
...
```

Executor wajib membaca:

- original task;
- previous implementation;
- revision instruction.

Executor tidak boleh mengulang semua implementation dari awal tanpa alasan.

---

# 34. Revision Executor Report

```markdown
# REVISION REPORT

Task ID:
Revision:

## Issue

...

## Fix

...

## Files Changed

...

## Verification

...

## Acceptance Criteria

AC-03: PASS

## Additional Changes

NONE

## Production Actions

NONE
```

---

# 35. Revision Loop

```text
PM
↓
Revision Request
↓
Executor
↓
Revision
↓
Verification
↓
Revision Report
↓
PM
↓
Validation
```

Loop terus berjalan hingga:

```text
PASS
```

atau:

```text
ESCALATED
```

---

# 36. Escalation Rule

PM wajib mengeskalasi ke Ardy jika terdapat kondisi berikut.

### Architecture

- perlu mengubah architecture;
- perlu membuat major abstraction;
- perlu mengganti framework;
- perlu mengubah application boundary.

### Infrastructure

- membutuhkan server;
- membutuhkan DNS;
- membutuhkan infrastructure;
- membutuhkan deployment configuration production.

### Data

- production migration;
- destructive migration;
- sensitive data;
- irreversible data change.

### Security

- credential;
- secret;
- authentication architecture;
- authorization policy;
- security-sensitive behavior.

### Scope

- requirement bertentangan;
- scope meningkat signifikan;
- requirement client tidak cukup jelas;
- perubahan memengaruhi deliverable utama.

### Risk

- breaking change besar;
- high regression risk;
- potential data loss;
- production outage risk.

---

# 37. Escalation Format

```markdown
# ESCALATION

Project:
Task ID:
Raised By:
Status: BLOCKED

## Situation

...

## Why Escalation Is Required

...

## Options

### Option A
...

Impact:
...

Risk:
...

### Option B
...

Impact:
...

Risk:
...

## Recommendation

...

## Decision Required From Ardy

...
```

PM boleh memberikan recommendation teknis.

Keputusan akhir tetap milik Ardy.

---

# 38. PM Completion Decision

Jika seluruh validation berhasil:

```text
STATUS:
READY_FOR_ARDY_REVIEW
```

Bukan:

```text
DEPLOYED
```

dan bukan:

```text
PRODUCTION_DONE
```

---

# 39. Handoff #4
# PM → Ardy

Handoff terakhir harus singkat tetapi lengkap.

Format:

```markdown
# FINAL DELIVERY HANDOFF

Project:
Task ID:
Status: READY_FOR_ARDY_REVIEW

## Objective

...

## Result

PASS

## Changes

- ...
- ...
- ...

## Acceptance Criteria

- [x] AC-01
- [x] AC-02
- [x] AC-03
- [x] AC-04

## Verification

Lint: PASS
Typecheck: PASS
Tests: PASS
Build: PASS
Functional: PASS

## Files Changed

- ...
- ...

## Known Limitations

None / ...

## Risks

LOW / MEDIUM / HIGH

Details:
...

## Follow-up Suggestions

- ...

## PM Validation

PASS

## Executor Production Actions

NONE

## Production Status

NOT_DEPLOYED

## Required Ardy Action

- Final review
- Production decision
- Deployment if approved
```

---

# 40. Ardy Final Decision

Ardy dapat memberikan salah satu status:

```text
APPROVED
REVISION_REQUIRED
ON_HOLD
REJECTED
```

Jika:

```text
APPROVED
```

Ardy dapat melakukan production process sendiri.

Agent workflow selesai.

---

# 41. Definition of Done

Task dianggap selesai secara internal apabila:

```markdown
- [ ] Implementation selesai
- [ ] Executor verification selesai
- [ ] Executor report tersedia
- [ ] PM validation selesai
- [ ] Semua required AC PASS
- [ ] Tidak ada unresolved blocker
- [ ] Tidak ada unauthorized change
- [ ] Tidak ada production action oleh agent
- [ ] PM menandai READY_FOR_ARDY_REVIEW
- [ ] Ardy memberikan final approval
```

Production deployment adalah proses terpisah.

---

# 42. Definition of Closed

Status `CLOSED` berarti:

```text
Ardy final review completed
AND
No remaining delivery action required
```

`CLOSED` tidak harus berarti agent melakukan deployment.

---

# 43. Severity Classification

PM dapat mengklasifikasikan task:

## LOW

Contoh:

- copy change;
- simple styling;
- isolated UI adjustment.

## MEDIUM

Contoh:

- component behavior;
- API integration;
- shared component;
- frontend state.

## HIGH

Contoh:

- authentication;
- authorization;
- payment flow;
- database behavior;
- architecture;
- security-related code.

HIGH-risk task dapat membutuhkan review Ardy lebih awal.

---

# 44. Task Size

Task idealnya atomic.

Bad:

```text
Build dashboard.
```

Better:

```text
DASH-001 Create dashboard shell
DASH-002 Implement sidebar navigation
DASH-003 Implement revenue card
DASH-004 Integrate analytics endpoint
DASH-005 Add responsive behavior
```

---

# 45. PM Task Splitting Rules

Pisahkan task jika:

- menyentuh concern berbeda;
- memiliki independent acceptance criteria;
- bisa diverifikasi sendiri;
- risiko berbeda;
- dependency berbeda;
- kemungkinan revision tinggi.

Jangan terlalu granular sampai setiap perubahan satu baris menjadi task.

---

# 46. Dependency Rule

Contoh:

```text
FE-101
↓
FE-102
↓
FE-103
```

PM tidak boleh assign `FE-103` jika `FE-102` merupakan dependency wajib dan belum selesai.

---

# 47. Parallel Work Rule

Task boleh parallel jika:

```text
No shared blocking dependency
No conflicting files
No conflicting architecture change
No sequencing requirement
```

PM bertanggung jawab mendeteksi kemungkinan conflict.

---

# 48. Change Isolation

Executor hanya mengubah file yang relevan.

Jika perubahan membutuhkan file tambahan yang sebelumnya tidak disebutkan:

- executor boleh melanjutkan jika jelas merupakan kebutuhan implementation yang kecil dan aman;
- executor harus mencatatnya pada report;
- jika menyebabkan scope signifikan berubah, gunakan Scope Change Protocol.

---

# 49. Git Safety Rules

Executor wajib:

```text
inspect git state
avoid overwriting unrelated changes
avoid destructive reset
avoid forced operations
preserve user changes
```

Dilarang menggunakan operasi destructive terhadap pekerjaan yang bukan miliknya tanpa explicit approval.

---

# 50. Existing Changes Rule

Jika repository sudah memiliki perubahan:

```markdown
Existing Changes Detected:
- file A
- file B
```

Executor harus menentukan apakah:

```text
SAFE_TO_CONTINUE
```

atau:

```text
BLOCKED_BY_EXISTING_CHANGES
```

Executor tidak boleh menghapus existing changes.

---

# 51. Testing Responsibility

Executor bertanggung jawab menjalankan test yang tersedia dan relevan.

PM bertanggung jawab memastikan test tersebut cukup untuk acceptance.

Executor:

```text
runs verification
```

PM:

```text
validates result
```

---

# 52. Missing Test Infrastructure

Jika project tidak memiliki tests:

Executor melaporkan:

```text
Automated Tests: NOT_AVAILABLE
```

Lalu menggunakan verification lain:

```text
build
lint
typecheck
manual functional check
browser validation
```

PM tidak boleh mengklaim test `PASS` jika tidak ada test.

---

# 53. Build Failure Rule

Jika build gagal:

```text
Task cannot be marked PASS
```

kecuali dapat dibuktikan failure:

- pre-existing;
- unrelated;
- diketahui dan diterima PM.

Harus didokumentasikan.

---

# 54. Requirement Conflict

Jika terdapat dua requirement yang bertentangan:

Executor berhenti.

PM menentukan source of truth.

Jika PM tidak dapat menentukan:

```text
ESCALATE_TO_ARDY
```

---

# 55. Assumption Policy

Agent boleh menggunakan asumsi hanya untuk hal kecil yang:

- reversible;
- tidak mengubah business behavior;
- sesuai existing convention;
- tidak memengaruhi architecture;
- tidak memperluas scope.

Asumsi harus dicatat.

Contoh:

```markdown
## Assumptions

- Existing spacing token digunakan karena requirement tidak menentukan spacing khusus.
```

---

# 56. No Silent Decisions

Semua keputusan penting harus masuk salah satu kategori:

```text
Requirement
Constraint
Assumption
PM Decision
Ardy Decision
```

Tidak boleh ada major decision tersembunyi di implementation.

---

# 57. Follow-up Suggestion

Executor atau PM boleh menemukan improvement tambahan.

Format:

```markdown
# FOLLOW-UP SUGGESTION

Title:

Observation:
...

Suggested Improvement:
...

Reason:
...

Priority:
LOW / MEDIUM / HIGH

Related Task:
...
```

Suggestion bukan bagian dari current task kecuali PM mengubah scope secara eksplisit.

---

# 58. Bug Discovered During Task

Jika bug tidak menghalangi task:

```text
REPORT
→ FOLLOW-UP
→ CONTINUE
```

Jika bug menghalangi task:

```text
PAUSE
→ REPORT
→ PM DECISION
```

---

# 59. Security Discovery

Jika menemukan kemungkinan security issue:

```text
STOP
→ DO NOT EXPLOIT
→ DOCUMENT MINIMALLY
→ ESCALATE TO PM
→ PM ESCALATES TO ARDY
```

Jangan memperluas investigasi tanpa kebutuhan.

---

# 60. Production Boundary

Agent tidak memiliki authority terhadap:

```text
Production Deploy
Production Server
Production Database
Production Credentials
Production DNS
Cloud Infrastructure
Production Environment Variables
Domain Configuration
Production Backups
Live Traffic Control
```

Semua area tersebut berhenti pada:

```text
RECOMMENDATION
```

dan menunggu Ardy.

---

# 61. Communication Standard

Agent harus menggunakan komunikasi:

```text
Specific
Traceable
Task-oriented
Evidence-based
Minimal ambiguity
```

Hindari:

```text
"Sudah beres."
"Sepertinya aman."
"Kayaknya bisa."
"Harusnya working."
```

Gunakan:

```text
Build: PASS
AC-01: PASS
AC-02: FAIL
Blocker: missing API contract
```

---

# 62. Evidence Standard

Setiap claim penting idealnya memiliki evidence.

Contoh:

```markdown
Claim:
Build berhasil.

Evidence:
`npm run build` exited with code 0.
```

atau:

```markdown
AC-01:
PASS

Evidence:
Tested at 320px viewport.
No horizontal scrollbar observed.
```

---

# 63. Handoff Completeness Rule

Handoff dianggap invalid jika tidak ada:

```text
Task ID
Status
Summary
Acceptance Criteria status
Verification
Known risks
Next owner
```

---

# 64. Ownership Rule

Setiap saat hanya ada satu active owner.

Contoh:

```text
Ardy
↓
PM owns
↓
Executor owns
↓
PM owns
↓
Ardy owns
```

Tidak boleh ambigu siapa yang bertanggung jawab terhadap next action.

---

# 65. Handoff Header

Gunakan header:

```markdown
FROM:
TO:
PROJECT:
TASK:
STATUS:
NEXT ACTION:
```

Contoh:

```markdown
FROM: PM
TO: Executor
PROJECT: Ayaa Wae Website
TASK: FE-024
STATUS: READY
NEXT ACTION: Preflight
```

---

# 66. Complete Handoff Flow

```text
┌─────────────────────────────┐
│            ARDY             │
│     Request / Direction     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│             PM              │
│ Requirement Interpretation  │
│ Scope                       │
│ Task Breakdown              │
│ Acceptance Criteria         │
│ Definition of Ready         │
└─────────────┬───────────────┘
              │
              │ READY
              ▼
┌─────────────────────────────┐
│          EXECUTOR           │
│ Preflight                   │
│ Plan                        │
│ Implement                   │
│ Verify                      │
│ Report                      │
└─────────────┬───────────────┘
              │
              │ IMPLEMENTED
              ▼
┌─────────────────────────────┐
│             PM              │
│ Inspect                     │
│ Validate                    │
│ Acceptance Check            │
│ Regression Check            │
└──────────┬────────┬─────────┘
           │        │
         FAIL      PASS
           │        │
           ▼        ▼
      EXECUTOR     ARDY
       Revision    Final Review
           │        │
           └──PM────┘
```

---

# 67. Golden Rules

## Rule 01

**PM owns WHAT.**

PM menentukan:

- apa yang harus dicapai;
- scope;
- acceptance.

## Rule 02

**Executor owns HOW.**

Executor menentukan implementation approach selama tetap berada dalam constraint.

## Rule 03

**Ardy owns WHY + FINAL DECISION.**

Ardy menentukan:

- business direction;
- architecture besar;
- production;
- keputusan final.

## Rule 04

Executor tidak self-assign.

## Rule 05

PM tidak boleh menerima hasil tanpa validation.

## Rule 06

No acceptance criteria = no execution.

## Rule 07

No production action by agents.

## Rule 08

Unknown high-impact decision = escalate.

## Rule 09

Unrelated improvement = follow-up task.

## Rule 10

Task selesai bukan ketika code ditulis.

Task selesai ketika hasil telah:

```text
implemented
+
verified
+
validated
+
approved
```

---

# 68. Minimum Task Contract

Untuk task kecil sekalipun, minimal harus ada:

```markdown
Task ID:
Objective:
Scope:
Acceptance Criteria:
Verification:
Out of Scope:
```

---

# 69. Minimum Executor Report

Minimal:

```markdown
Task:
Status:

Changes:
- ...

Verification:
- ...

Acceptance:
- ...

Risks:
- ...

Production Actions:
NONE
```

---

# 70. Minimum PM Validation

Minimal:

```markdown
Task:

AC-01: PASS
AC-02: PASS
AC-03: PASS

Scope Compliance:
PASS

Regression:
PASS

Decision:
READY_FOR_ARDY_REVIEW
```

---

# 71. Recommended Task ID Convention

Frontend:

```text
FE-001
FE-002
```

WordPress:

```text
WP-001
WP-002
```

Bug:

```text
BUG-001
```

Content:

```text
CNT-001
```

Infrastructure-related recommendation:

```text
OPS-001
```

Catatan:

`OPS` hanya boleh menghasilkan recommendation jika menyangkut production infrastructure.

---

# 72. Recommended Priority

```text
P0 — Critical blocker
P1 — High priority
P2 — Normal
P3 — Low
```

Priority bukan alasan untuk melewati QA.

---

# 73. Recommended Risk

```text
LOW
MEDIUM
HIGH
CRITICAL
```

`CRITICAL` harus otomatis diekskalasi ke Ardy.

---

# 74. Agent Decision Matrix

| Situation | Executor | PM | Ardy |
|---|---|---|---|
| Simple implementation | Execute | Validate | Review akhir |
| Scope ambiguity | Stop | Resolve | Jika perlu |
| Architecture decision | Stop | Escalate | Decide |
| Bug dalam scope | Fix | Validate | — |
| Bug di luar scope | Report | Create follow-up | — |
| Dependency upgrade | Stop | Review | Approve jika significant |
| Production deploy | No | No | Yes |
| Server change | No | No | Yes |
| DNS | No | No | Yes |
| Production DB | No | No | Yes |
| Minor code convention | Decide | Validate | — |
| Major refactor | Stop | Escalate | Decide |
| Security issue | Stop | Escalate | Decide |

---

# 75. Final Principle

Ayaa Wae Studio menggunakan sistem:

```text
Human-controlled
Agent-executed
PM-validated
Production-isolated
```

PM menjaga task tetap jelas.

Executor menjaga implementation tetap disiplin.

Ardy menjaga keputusan besar dan production tetap berada di bawah kontrol manusia.

Tujuan sistem ini bukan membuat agent memiliki kebebasan maksimum.

Tujuannya adalah membuat agent memiliki:

```text
clear responsibility
+
clear boundary
+
clear evidence
+
clear handoff
+
clear escalation
```

sehingga Ayaa Wae Studio dapat beroperasi sebagai solo studio dengan proses delivery yang konsisten dan dapat dikembangkan.