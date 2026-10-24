# Product Engineering Skills (PES) — Design Spec

- **Tanggal:** 2026-10-25
- **Status:** Draft, menunggu review
- **Lingkup:** Fork skill (mattpocock/skills), package `@pes/format`, CLI `pes`, dan platform SaaS PES

---

## 1. Ringkasan

PES adalah framework product engineering yang **human-driven** untuk coding agent (Claude Code dan Codex). Alurnya: discovery → PRD → prototype HTML yang bisa diklik → spec → sub-ticket → plan dan eksekusi lokal.

Sistem terdiri dari dua bagian:

1. **Sisi klien (open source, MIT):** fork `mattpocock/skills` berisi skill PES, package `@pes/format`, dan CLI `pes`.
2. **Platform SaaS (privat):** source of truth untuk PRD, prototype, spec, ticket, sub-ticket, dan approval. Web dipakai untuk melihat, mengedit, comment, approve, dan preview prototype.

Plan dan task dibuat dan dijalankan di lokal oleh agent, memakai skill PES atau Superpowers. Platform tidak menyimpan plan maupun task. Yang dikirim balik hanya status sub-ticket dan link PR.

## 2. Prinsip

1. **Human-driven.** AI menggali, mengusulkan, dan menyusun. Manusia yang memutuskan kapan sebuah fase boleh lanjut.
2. **Approval hanya oleh manusia.** Token yang dipegang agent tidak pernah punya izin approve.
3. **Satu sumber aturan format.** Parser dan validator ID hanya ada di `@pes/format` dan dipakai oleh CLI, server, dan editor web.
4. **Mudah dibaca agent dan manusia.** Semua artefak berupa markdown biasa (prototype berupa HTML).
5. **Perubahan setelah approval tidak boleh diam-diam.** Approval terikat pada revisi, dan perubahan requirement menandai turunannya sebagai stale.

## 3. Keputusan yang terkunci

| Aspek | Keputusan |
|---|---|
| Foundation skill | Fork `mattpocock/skills`; skill baru di folder terpisah `skills/pes/` |
| Platform | Dibangun sendiri (tidak fork Plane). Plane hanya referensi UX, tidak ada kode yang disalin |
| Source of truth | Platform: PRD, prototype, spec, ticket, sub-ticket, approval |
| Lokal | Plan dan task milik agent. Tidak disinkronkan ke platform |
| Penulis artefak | Agent (push lewat CLI) dan manusia (editor markdown di web) |
| Format | Markdown dengan konvensi ID (`REQ-`, `AC-`); prototype memakai `data-req` |
| Konflik | Optimistic revision (`base_revision`); push dengan revisi usang ditolak |
| Model bisnis | SaaS multi-tenant, gratis/beta, tanpa billing (skema sudah menyiapkan `plan` dan batas pemakaian) |
| Login CLI | OAuth Device Authorization Flow (RFC 8628), dibangun di platform |
| Approval | Di web, atau dimulai dari CLI lalu dikonfirmasi satu klik di halaman web |
| Gate | Tiga: PRD → Prototype → Spec. Sub-ticket tanpa gate |
| Prototype | Satu file HTML dengan banyak layar (hash routing), CSS/JS inline, anotasi `data-req` |
| Umpan balik dari lokal | Status sub-ticket dan link PR saja |
| Stack | TypeScript penuh: Next.js, Postgres (RLS), object storage, CLI Node (npm) |
| Harness MVP | Claude Code dan Codex |

## 4. Arsitektur

### 4.1 Repositori

```
① product-engineering-skills      fork mattpocock/skills — publik, MIT
   ├── skills/…                    skill upstream (diubah seminimal mungkin)
   ├── skills/pes/…                skill PES
   ├── packages/format/            @pes/format
   ├── packages/cli/               @pes/cli (perintah `pes`)
   └── THIRD_PARTY_NOTICES.md      atribusi mattpocock/skills dan Superpowers

② pes-platform                    privat
   └── apps/web/                   Next.js (UI + API), bergantung pada @pes/format dari npm
```

Skill baru ditaruh di `skills/pes/` dan perubahan pada skill upstream dibuat seminimal mungkin, supaya merge dari upstream jarang konflik.

### 4.2 Komponen

| Komponen | Tanggung jawab | Bergantung pada |
|---|---|---|
| Skill PES | Memandu tiap fase dan memanggil CLI | CLI, skill upstream (`grilling`, `domain-modeling`, `prototype`, `to-tickets`, `tdd`, `code-review`) |
| `@pes/format` | Parse PRD/spec → indeks REQ/AC, validasi ID, diff per requirement, baca `data-req` dari prototype | — |
| CLI `pes` | Auth, push/pull artefak, approval, update status | `@pes/format`, API platform |
| Platform web/API | Workspace, member, ticket, artefak dan revisi, editor, comment, approval, status sub-ticket | `@pes/format`, Postgres, object storage, provider auth |
| Postgres + RLS | Penyimpanan; isolasi tenant ditegakkan di database | — |
| Object storage + domain usercontent | Menyimpan dan menyajikan prototype di origin terpisah | — |

Skill `setup-matt-pocock-skills` diberi opsi tracker baru, **"PES Platform"**, supaya skill upstream seperti `to-tickets` bisa mem-publish ke platform.

### 4.3 Alur end-to-end

```
[lokal] /pes-discovery (chat) → /pes-prd → pes push prd ──────────► Ticket: PRD draft
                                    pes approve prd → klik ───────► PRD approved
[lokal] /pes-prototype → pes push prototype ──────────────────────► Prototype draft
                                    pes approve prototype → klik ─► Prototype approved
[lokal] /pes-spec → pes push spec ────────────────────────────────► Spec draft
                                    pes approve spec → klik ──────► Spec approved
[lokal] /pes-breakdown → pes push subtickets ─────────────────────► Sub-ticket PROJ-12.1..n

[agent dev] /pes-writing-plans PROJ-12.3
   → pes pull → docs/superpowers/specs/<tgl>-proj-12-3-design.md
   → plan di docs/superpowers/plans/
[agent dev] /pes-executing-plans
   → pes ticket update PROJ-12.3 --status in_progress
   → task dikerjakan (tdd, code-review)
   → pes ticket update PROJ-12.3 --status done --pr <url> ──────► Status sub-ticket
```

## 5. Model data

```
Workspace (plan, limits)
├─ Member (user, role: owner | admin | editor | viewer)
├─ CliSession (user, hostname, scopes, refresh_token_hash, last_used_at, revoked_at)
└─ Project (key: PROJ)
   └─ Ticket (key: PROJ-12, title)
      ├─ Artifact (kind: prd | prototype | spec, gate_status, current_revision)
      │  └─ Revision (n, sha256, base_revision, content_ref, author_user, via: web | cli,
      │               req_index (hasil parse), created_at)
      ├─ Approval (artifact, revision, sha256, user, via: web | cli-link, created_at)
      ├─ SubTicket (key: PROJ-12.3, title, body, spec_revision, refs: [REQ/AC],
      │             blocked_by: [SubTicket], status, pr_url, stale)
      └─ Comment (author, anchor: {revision, req_id | line_range | prototype_screen}, body)
ApprovalRequest (artifact, revision, sha256, created_by_cli_session, expires_at, consumed_at)
```

- Semua tabel menyimpan `workspace_id`.
- Isi revisi disimpan di object storage (`content_ref`). Metadata dan `req_index` disimpan di Postgres.

## 6. Format dan konvensi

### 6.1 PRD

```md
### REQ-001 Agreement wajib sebelum Product Order
Product Order hanya bisa dibuat jika Agreement berstatus Approved.
**Status:** decided · **Criticality:** blocker

- [AC-001] Given Agreement Draft, when user membuat Product Order, then ditolak dengan pesan …
- [AC-002] Given Agreement Approved, when …, then …
```

- `Status` yang diizinkan: `proposed`, `decided`, `verified`, `open`, `conflicted`, `not-applicable`, `removed`.
- `Criticality` yang diizinkan: `blocker`, `major`, `minor`.

### 6.2 Spec

Spec mengikuti gaya design doc Superpowers: arsitektur, komponen, alur data, error handling, testing. Setiap bagian yang mengimplementasikan requirement memuat baris:

```md
**Implements:** REQ-001, REQ-003
```

### 6.3 Prototype

Prototype berupa satu file HTML. Layar dipisahkan dengan hash routing (`#/screen-name`), dan elemen yang mewakili requirement ditandai `data-req="REQ-001"`. Satu elemen boleh mewakili beberapa requirement (`data-req="REQ-001 REQ-004"`).

### 6.4 Aturan ID

Aturan ini ditegakkan oleh `@pes/format`, baik di CLI sebelum push maupun di server saat menyimpan.

1. Lingkup ID adalah per ticket.
2. ID tidak pernah dinomori ulang atau dipakai ulang. Requirement yang dihapus diberi status `removed` dan tetap ada di dokumen.
3. Ditolak jika ada:
   - ID ganda;
   - `AC-` di luar blok `REQ-`;
   - `Implements` atau `data-req` yang merujuk ID yang tidak ada atau berstatus `removed`;
   - status atau criticality yang tidak dikenal.
4. Pesan error menyertakan nomor baris, dan teksnya identik di CLI dan server.

## 7. Gate, status, dan stale

### 7.1 Status

| Objek | Status |
|---|---|
| Gate artefak | `draft`, `approved`, `stale`, `not_applicable` |
| Sub-ticket | `todo`, `in_progress`, `blocked`, `done` |

### 7.2 Aturan gate

1. Prototype hanya bisa di-approve jika revisi PRD yang berlaku sudah `approved`.
2. Spec hanya bisa di-approve jika PRD `approved` dan prototype `approved` atau `not_applicable`.
3. Sub-ticket hanya bisa dibuat dari spec `approved`, dan menyimpan `spec_revision` asalnya.
4. PRD tidak bisa di-approve selama ada REQ dengan `Criticality: blocker` yang berstatus `open` atau `conflicted`.
5. Prototype boleh ditandai `not_applicable` (untuk fitur tanpa UI) hanya oleh manusia, wajib dengan alasan, dan lewat jalur approval yang sama.

### 7.3 Propagasi stale

Ketika artefak yang sudah `approved` mendapat revisi baru:

1. Gate artefak itu kembali ke `draft` dan perlu di-approve ulang.
2. `@pes/format` menghitung ID REQ yang ditambah, diubah, atau dihapus antara revisi approved terakhir dan revisi baru.
3. Turunan yang merujuk ID tersebut ditandai `stale`:
   - Perubahan PRD → gate prototype jadi `stale` jika ada layar dengan `data-req` terkait (layar tersebut disorot di platform), gate spec jadi `stale` jika ada bagian dengan `Implements` terkait (bagian tersebut disorot), dan sub-ticket dengan `refs` terkait diberi flag `stale`.
   - Perubahan spec → sub-ticket yang dibuat dari revisi spec sebelumnya dan merujuk REQ yang `Implements`-nya berubah diberi flag `stale`.
4. Revisi yang hanya mengubah teks di luar blok REQ/AC tetap butuh approve ulang, tetapi **tidak** membuat turunannya stale.
5. Status `stale` hilang setelah turunan direvisi dan di-approve ulang. Untuk sub-ticket, status itu hilang ketika manusia menandainya sudah ditinjau.

## 8. Auth dan keamanan

### 8.1 Login web

Login web memakai provider auth terkelola dengan Google, GitHub, dan magic link email. Provider spesifiknya dipilih saat planning M2.

### 8.2 Device flow untuk CLI

Device flow (RFC 8628) dibangun di platform sendiri.

1. `pes login` meminta `device_code` dan `user_code`.
2. CLI menampilkan URL verifikasi beserta kode, lalu membuka browser.
3. Di web (sudah login), user melihat permintaan "pes CLI di `<hostname>` meminta akses ke workspace X" dan mengklik **Izinkan**.
4. CLI polling sampai menerima access token (1 jam) dan refresh token (30 hari, rotasi setiap dipakai).
5. Token disimpan di keychain OS. Kalau keychain tidak tersedia, token disimpan di `~/.config/pes/credentials.json` dengan permission 0600.

- **Scope token CLI:** `read`, `write:artifacts`, `write:status`, `comment`. Scope `approve` **tidak pernah** diberikan ke token CLI.
- Sesi CLI bisa dilihat dan dicabut dari web.

### 8.3 Approval yang dimulai dari CLI

1. `pes approve <gate> <ticket>` membuat `ApprovalRequest` yang terikat pada revisi dan sha256 saat ini, dan kedaluwarsa dalam 10 menit.
2. CLI menampilkan ringkasan: gate, revisi, diff REQ sejak approval terakhir, dan blocker. Setelah itu CLI membuka `/approve/<id>`.
3. Halaman web menampilkan ringkasan yang sama dan tombol **Approve** atau **Tolak**. Halaman ini butuh sesi web yang aktif dan dilindungi CSRF.
4. Saat tombol diklik, server memeriksa ulang:
   - revisi masih yang terbaru;
   - sha256 cocok;
   - aturan gate pada bagian 7.2 terpenuhi;
   - user punya role `editor` atau lebih tinggi.
5. Approval dicatat dengan `via: cli-link`. Link hanya bisa dipakai sekali.
6. CLI menerima hasilnya lewat polling.

### 8.4 Isolasi tenant

- Setiap request API menetapkan `app.workspace_id` di transaksinya.
- Semua tabel punya policy RLS berdasarkan `workspace_id`.
- Membership dicek sebelum `app.workspace_id` ditetapkan.

### 8.5 Sandbox prototype

- Prototype disajikan dari domain terdaftar terpisah, misalnya `*.pes-usercontent.com`, dengan satu subdomain per workspace. Domain ini bukan subdomain dari domain app.
- Prototype ditampilkan di `<iframe sandbox="allow-scripts">` tanpa `allow-same-origin`.
- CSP:
  - `connect-src 'none'`;
  - script dan style hanya inline atau dari daftar CDN yang diizinkan;
  - `form-action 'none'`.
- Untuk workspace privat, file disajikan lewat URL bertanda tangan yang berumur pendek.

### 8.6 Role

| Role | Hak |
|---|---|
| owner | Semua hak, termasuk menghapus workspace |
| admin | Kelola anggota dan pengaturan, ditambah semua hak editor |
| editor | Membuat dan mengedit ticket dan artefak, approve, mengelola sub-ticket |
| viewer | Membaca dan memberi comment |

Anggota diundang lewat link undangan. MVP belum mengirim email.

### 8.7 Keterbatasan yang diketahui

Agent dengan browser tool yang memakai sesi login user (misalnya Claude in Chrome) secara teknis bisa membuka link approval dan mengklik Approve. MVP menerima risiko ini.

Mitigasi setelah MVP: konfirmasi approval dengan passkey (WebAuthn, dengan user verification).

## 9. Skill

### 9.1 Prinsip

- Setiap fase adalah skill yang **dipanggil user** dan berakhir dengan menyarankan perintah berikutnya, tanpa lanjut otomatis. Ini sesuai aturan upstream: skill user-invoked tidak memanggil skill user-invoked lain.
- Skill PES memakai skill upstream yang dipanggil model: `grilling`, `domain-modeling`, `tdd`, `code-review`.
- Setiap skill mengecek prasyaratnya lewat `pes status` sebelum mulai bekerja.
- Semua nama skill memakai prefix `pes-` supaya tidak bentrok dengan Superpowers.

### 9.2 Daftar skill

| Skill | Prasyarat | Perilaku | Output |
|---|---|---|---|
| `/pes-discovery` | — | Interview memakai `grilling`, satu pertanyaan per giliran. Di awal, user memilih ukuran fitur (9.3). Setiap jawaban diklasifikasikan sebagai fakta, keputusan, asumsi, atau open question. User yang mengonfirmasi criticality. Rekomendasi AI tidak pernah dianggap sebagai keputusan | `.pes/<ticket>/discovery.md` |
| `/pes-prd` | Discovery tanpa REQ `blocker` yang `open`/`conflicted` | Menulis PRD sesuai 6.1, lalu menjalankan `pes check` dan `pes push prd`. Ticket dibuat kalau belum ada. Tidak menambah requirement yang tidak ada di discovery | PRD draft |
| `/pes-prototype` | PRD approved | Adaptasi skill `prototype` upstream: satu HTML dengan banyak layar dan `data-req`, ditambah laporan REQ yang belum punya layar | Prototype draft |
| `/pes-spec` | PRD approved; prototype approved atau N/A | Design doc gaya Superpowers dengan `Implements:` di tiap bagian | Spec draft |
| `/pes-breakdown` | Spec approved | Adaptasi `to-tickets`: sub-ticket model tracer-bullet dengan `refs` dan `blocked_by` | Sub-ticket |
| `/pes-writing-plans <sub>` | Sub-ticket ada | Adaptasi `writing-plans` Superpowers. Menjalankan `pes pull`, menulis spec ke `docs/superpowers/specs/`, lalu menulis plan ke `docs/superpowers/plans/` dengan header `ticket`, `sub_ticket`, `spec_revision`. Setiap task merujuk REQ/AC | Plan lokal |
| `/pes-executing-plans` | Plan ada; `spec_revision` masih yang berlaku dan sub-ticket tidak stale | Adaptasi `executing-plans` Superpowers. Otomatis mengupdate status: `in_progress` saat mulai, `blocked` dengan alasan saat butuh manusia, dan `done` dengan link PR setelah terverifikasi | Kode, PR, status sub-ticket |

Agent yang memakai `writing-plans` atau `executing-plans` Superpowers biasa tetap bisa bekerja dari file hasil `pes pull` dan mengupdate status secara manual lewat CLI.

### 9.3 Ukuran discovery

Ada 10 dimensi discovery:
1. Problem & Outcome
2. Personas & Authorization
3. Scope & Boundaries
4. User Journey
5. Business Rules
6. Data & Integrations
7. Failure & Recovery
8. Acceptance Criteria
9. Constraints & Dependencies
10. Rollout & Migration

| Ukuran | Dimensi wajib |
|---|---|
| Kecil | Problem & Outcome, Scope & Boundaries, Business Rules, Acceptance Criteria |
| Sedang | Ukuran kecil, ditambah Personas & Authorization, User Journey, Data & Integrations, Failure & Recovery |
| Besar | Semua 10 dimensi |

- Dimensi yang tidak wajib boleh dilewati.
- Dimensi wajib boleh diberi status `not-applicable`, asalkan disertai alasan.

### 9.4 Folder lokal `.pes/`

```
.pes/
├── config.json          workspace + project (di-commit)
└── <ticket>/
    ├── discovery.md     log discovery (di-commit)
    └── cache/           hasil pull + revisi (di-gitignore)
```

### 9.5 Edit dari dua sisi

1. Jika `pes push` ditolak karena revisi usang (409), skill menjalankan `pes pull`.
2. Skill menggabungkan perubahan dan menampilkan diff-nya ke user.
3. Setelah user menyetujui hasil gabungan, skill push ulang.

## 10. Referensi perintah CLI (MVP)

| Perintah | Fungsi |
|---|---|
| `pes login` / `pes logout` | Device flow / mencabut sesi |
| `pes init` | Membuat `.pes/config.json` (pilih workspace dan project) |
| `pes check <file>` | Validasi format secara lokal |
| `pes push prd\|prototype\|spec <ticket> [file]` | Mengunggah revisi baru (dengan `base_revision`) |
| `pes push subtickets <ticket> <file>` | Membuat atau memperbarui sub-ticket dalam satu batch |
| `pes pull <ticket\|sub-ticket>` | Mengunduh artefak. Untuk sub-ticket, juga menulis file spec gaya Superpowers |
| `pes status [ticket]` | Status gate, stale, dan sub-ticket |
| `pes approve <gate> <ticket>` | Memulai approval lewat link konfirmasi |
| `pes ticket update <sub> --status … [--reason …] [--pr …]` | Update status sub-ticket |

## 11. Error handling

| Situasi | Perilaku |
|---|---|
| Offline atau jaringan gagal | Push gagal dengan pesan jelas, tanpa antrean diam-diam. Setiap push membawa request ID supaya aman di-retry |
| Access token kedaluwarsa | Refresh otomatis. Kalau refresh gagal, CLI meminta `pes login` |
| Revisi usang | 409 beserta revisi terbaru, lalu alur 9.5 |
| Format tidak valid | 422 dengan daftar error per baris, pesannya identik dengan `pes check` |
| ApprovalRequest kedaluwarsa atau revisi berubah | Ditolak dengan alasannya. User menjalankan ulang `pes approve` |
| Aturan gate belum terpenuhi | Ditolak dengan daftar prasyarat atau blocker yang kurang |
| Sub-ticket stale saat eksekusi | `pes-executing-plans` berhenti dan meminta plan ditinjau ulang. Update ke `done` tetap boleh, dengan peringatan |
| Prototype melebihi batas ukuran | Ditolak (default 5 MB per file) |
| Akses lintas workspace | 404, supaya keberadaan resource tidak bocor |

## 12. Testing

1. **`@pes/format`:** unit test ditambah fixture golden (input markdown → indeks, error, diff) yang dipakai bersama oleh test CLI dan server.
2. **API (integration, Postgres sungguhan):**
   - isolasi lintas tenant;
   - urutan gate;
   - blocker PRD;
   - propagasi stale, termasuk kasus perubahan yang hanya prosa;
   - optimistic revision;
   - alur ApprovalRequest (kedaluwarsa, sekali pakai, revisi berubah);
   - device flow dan scope token (token CLI tidak bisa approve).
3. **CLI end-to-end:** dijalankan terhadap platform lokal (docker compose).
4. **Keamanan prototype:** prototype tidak bisa membaca cookie app, tidak bisa melakukan fetch, dan tidak bisa submit form.
5. **Eval perilaku skill:** berbasis skenario, dijalankan beberapa kali per skenario. Skenarionya:
   - satu pertanyaan per giliran;
   - menolak membuat PRD saat masih ada blocker yang open;
   - tidak mengarang aturan ketika user menjawab "belum tahu";
   - tidak pernah mengklaim sesuatu sudah approved tanpa konfirmasi dari server;
   - update status di awal dan akhir eksekusi;
   - berhenti ketika sub-ticket stale.

## 13. Lingkup MVP

### 13.1 Termasuk

Semua yang dijelaskan di bagian 4–12.

### 13.2 Di luar MVP

- Billing
- Passkey untuk approval
- Kolaborasi real-time
- Sinkronisasi task plan ke platform
- CLI binary tunggal
- Adapter OMP
- Integrasi Jira/GitHub Issues
- Notifikasi email

## 14. Milestone

Setiap milestone punya implementation plan sendiri.

| # | Milestone | Isi |
|---|---|---|
| M1 | `@pes/format` | Konvensi, parser PRD/spec/prototype, validator, diff REQ, fixture golden |
| M2 | Inti platform | Login web, workspace/member/role/undangan, project, ticket, artefak dan revisi, editor markdown, comment, RLS |
| M3 | CLI | `login`, `init`, `check`, `push`, `pull`, `status` |
| M4 | Gate dan approval | Approval di web, ApprovalRequest dari CLI, aturan gate, propagasi stale |
| M5 | Hosting prototype | Object storage, domain usercontent, sandbox, CSP, URL bertanda tangan |
| M6 | Skill fase produk | Fork repo, `pes-discovery`, `pes-prd`, `pes-prototype`, `pes-spec`, `pes-breakdown`, opsi tracker di setup |
| M7 | Sub-ticket dan eksekusi | Sub-ticket dengan `blocked_by`, `pes ticket update`, `pes-writing-plans`, `pes-executing-plans` |

## 15. Kriteria sukses MVP

Satu fitur OSS/BSS nyata berhasil berjalan dari discovery sampai PR, dengan syarat:

- approval manusia tercatat di ketiga gate;
- sub-ticket dikerjakan oleh agent dengan status yang terupdate otomatis;
- alurnya dijalankan di Claude Code dan Codex tanpa kehilangan konteks (keputusan dan artefak dibaca dari `.pes/` dan platform, bukan dari riwayat chat).

## 16. Lisensi dan atribusi

- `mattpocock/skills` berlisensi MIT, dan Superpowers berlisensi MIT. Status lisensi ini diverifikasi ulang saat fork di M6.
- Atribusi keduanya dicatat di `THIRD_PARTY_NOTICES.md`.
- Platform tidak memakai kode Plane (AGPL-3.0).

## 17. Keputusan yang ditunda ke planning

| Keputusan | Milestone |
|---|---|
| Provider auth web | M2 |
| Penyedia hosting, Postgres, dan object storage | M2 |
| Nama domain app dan domain usercontent | M2 / M5 |
| Daftar CDN yang diizinkan di CSP prototype | M5 |
| Library editor markdown di web | M2 |
