# Dende Roadmap

This is the canonical product and infrastructure roadmap for Dende. It reflects
the current implementation and should be updated whenever a material capability
is completed or reprioritized.

Last reconciled: 14 August 2026. The Cross River acquisition campaign is paused
at the user's direction after the Kwa Falls evidence bundle. No additional
subject should be researched or activated until the campaign is resumed.

## Product direction

Dende helps people understand a parcel before buying, registering, or relying
on it. It converts survey plans and coordinates into mapped boundaries, checks
them against available spatial records, and clearly distinguishes official,
reference, user-submitted, and verified information.

The current priority is reliable infrastructure and transparent results. Basic
individual accounts and secure sessions now exist as the dependency foundation;
contact verification, recovery delivery, authorization roles and public
production access remain gated until their security and abuse controls are ready.

Dende's commercial value is layered land-risk screening and verification, not
the sale of access to a database. Automated results must always state their
coverage limits and must never be presented as proof of title.

## Completed foundation

- [x] Convert supported Nigerian projected coordinates, WGS84 UTM, and GPS
  coordinates into WGS84 GeoJSON.
- [x] Extract coordinate tables and bearing/distance traverses from survey-plan
  images using multiple vision providers and local OCR fallback.
- [x] Validate geometry through area comparison, closure, vertex, and
  self-intersection checks.
- [x] Persist parcels in PostGIS and detect plot overlaps, road corridors, and
  reserve intersections.
- [x] Maintain violation cases with severity, status, rechecks, notes,
  resolution, and event history.
- [x] Support survey uploads, manual coordinate entry, CRS selection, bulk
  paste, live preview, check-only, and check-and-register workflows.
- [x] Provide registry, plot-detail, and violation-history maps.

## Completed source and provenance infrastructure

- [x] Register datasets by type, provider, authority level, country,
  administrative coverage, format, URL, license, lifecycle, and coverage.
- [x] Record immutable imports with file metadata, checksums, record counts,
  timestamps, importer details, and diagnostics.
- [x] Classify plots as survey submissions, manual submissions, ownership
  notices, official cadastral records, or reference/test records.
- [x] Link plots and zone layers to source and import records.
- [x] Backfill existing Calabar development records as test/reference data.
- [x] Provide a Data Sources page with coverage, record counts, authority,
  freshness, import metrics, and known limitations.

## Completed ownership-notice infrastructure

- [x] Store ownership notices against parcel geometry with submission,
  statement, visibility, expiry, dispute, transfer, and withdrawal metadata.
- [x] Accept voluntary timestamped notices without requiring an account.
- [x] Label notices as unverified unless a separate verification record exists.
- [x] Support auditable verification levels for future identity, document,
  professional, surveyor, lawyer, or authority verification services.
- [x] Surface notice date and verification status when a checked parcel
  overlaps a protected parcel.

## Completed product experience

- [x] Add shared navigation across all user-facing pages.
- [x] Put an interactive, check-only boundary experience on the homepage.
- [x] Provide clean, overlap, zoning, and ownership-notice examples.
- [x] Add a concise registry table with location, area, findings, date, and
  ten-record pagination.
- [x] Make plot overlap and zoning finding cards fully clickable.
- [x] Add responsive layouts across the homepage, checker, source records,
  protection form, plot map, and violation history.
- [x] Add mobile navigation, stacked coordinate cards, mobile record cards,
  dynamic viewport sizing, and improved touch targets.

## Now — transparent check evidence

- [x] Record the exact dataset versions and imports consulted by every check.
- [x] Show consulted datasets, authority level, geography, freshness, and
  coverage status directly in each check result.
- [x] Distinguish complete, partial, stale, unavailable, and test-only coverage.
- [x] Explain when a clean result means only “no conflict in available data.”
- [x] Link result disclosures to the relevant source and import details.

## Next — durable ownership and source workflows

- [x] Preserve immutable ownership-notice and verification histories so newer
  submissions cannot silently replace earlier claims or conflicts.
- [x] Add individual source pages and immutable import-history details.
- [x] Add source filtering and coverage search.
- [x] Add privacy-safe contact, challenge, correction, and withdrawal flows.
- [ ] Add moderation, dispute resolution, renewals, transfers, notifications,
  and monitoring.

## Expansion

### Binding spatial acquisition programme

The required workflow is documented in
`docs/SPATIAL_ASSET_ACQUISITION_PROCEDURE.md`. Geometry capable of checking a
submitted parcel is the success criterion; media and portal records are discovery
inputs, not coverage.

- [x] Adopt the government inventory → authoritative instrument → geometry
  acquisition → validation → activation → media discovery sequence.
- [ ] Rerun Cross River from the beginning under the spatial procedure — paused
  after approved single-subject work on CFTZ, Marina Resort, Obudu Mountain
  Resort/approach-road ROW and Kwa Falls. The inventory now contains 63 distinct
  spatial targets: 55 queued, four researching and four with representative or
  source-located geometry. All 63 remain excluded from spatial checks.
- [ ] Rerun Akwa Ibom from the beginning under the spatial procedure.
- [ ] Run national/federal assets after both pilot-state reruns.
- [ ] Process every remaining state with inventory and geometry completion gates.

- [x] Catalogue the federal geospatial custodians and authoritative land-data
  authority for all 36 Nigerian states plus the FCT, including planned sources
  whose records are not yet available.
- [x] Keep planned/unavailable catalogue entries visible in coverage reporting
  while strictly excluding them from spatial checks and check evidence.
- [x] Separate target authorities and service portals from actual usable
  datasets with an explicit acquisition/access stage.
- [x] Audit Cross River target authorities for downloadable files, documented
  APIs, map services, formal data requests, licensing, cost, CRS, and currency.
- [ ] Send formal acquisition enquiries to CRGIA, the Office of the
  Surveyor-General, Forestry Commission, National Park Service, Ministry of
  Works, and Urban Development Authority; record their responses and terms.
- [ ] Import broader authoritative and licensed datasets for Cross River State
  and other Nigerian states.
- [ ] Expand to additional countries using ISO country codes, administrative
  boundaries, and source-specific CRS metadata.
- [ ] Integrate official cadastral and title searches where authority access
  and licensing permit it.
- [ ] Add coverage-quality dashboards and operational import monitoring.

## Now — historical land intelligence

Cross River is the pilot for finding allocations, acquisitions, revocations,
returns, layouts, title notices, survey approvals, reserves, road corridors,
planning changes and court outcomes in fragmented public records.

- [x] Add immutable source documents, normalized land events, evidence links,
  parties, event relations, review history and stable external ingestion keys.
- [x] Separate extraction confidence, evidence authority, human review,
  searchability, geometry quality and spatial-check eligibility.
- [x] Enforce that only accepted tier-1/2 evidence with derived or authoritative
  geometry can become eligible for spatial checks.
- [x] Seed a small Cross River evidence set from official ministry pages,
  government news, budgets and statistical publications.
- [x] Complete the expanded Cross River discovery and approved subject passes:
  34 searchable land events and 43 preserved supporting documents are currently
  stored. Thirty-three events remain contextual and excluded from checks; one
  earlier event is eligible under the evidence gate. Spatial-asset inventory
  records remain independently excluded unless validated geometry is activated.
- [x] Add a public historical-evidence catalogue and evidence-detail pages.
- [x] Build the secured discovery, acquisition-status, AI-analysis and review
  queue API; preserve source URLs, checksums, storage URIs and immutable runs.
- [ ] Connect durable object storage and archive original downloaded bytes.
- [x] Add discovered-file, extraction-run, numeric-observation and geometry-
  candidate contracts with CRS, page locator, validation and review fields.
- [x] Define discovery and extraction profiles for PDF, images, Word files,
  spreadsheets, delimited data, native geospatial files, HTML and archives.
- [x] Seed the Cross River file queue with official yearbook, budget, facts and
  figures, and programme-guideline PDFs found in public government storage.
- [ ] Implement file acquisition, checksum/archive storage, PDF text extraction,
  rendered-page inspection and OCR fallback.
- [ ] Extract and review coordinates, bearings, distances, areas, beacons,
  plot/layout references, survey numbers and title references from queued files.
- [ ] Systematically research Cross River gazettes, notices, approved lists,
  budgets, yearbooks, court decisions, layouts, schemes and archived pages.
- [ ] Resolve historical place/layout/plot references and acquire or derive
  geometry without overstating location confidence.
- [ ] Add contradiction, correction and supersession review tools.
- [x] Define a constrained idempotent ingestion API/staging contract for a
  future separate scheduled-workflow repository.
- [ ] Create that separate workflow repository only after the receiving schema,
  review process and source-quality rules have proven stable in Cross River.

### Parallel research-skill pipeline

Data acquisition is a parallel operational programme and should not block the
main product build. Coverage grows gradually through schema-gated staging; no
skill output becomes searchable or check eligible merely because a run finished.

- [x] Add a `sourcer` skill with a jurisdiction lock, 21-query state inventory,
  per-asset progression, strict query/run schemas and approved-asset handoff.
- [x] Add an `evidence-acquirer` skill with explicit evidence bundles,
  checksums, file/jurisdiction identity, visual-inspection state, observation
  provenance and an asset-relevance gate.
- [x] Add a `geometry-evidence-reviewer` skill with identity, CRS, topology,
  area, coverage, currency and activation-prerequisite gates.
- [x] Add deterministic positive and negative contract validation across all
  three stages. The earlier FCT AGIS/Imo association is rejected by the current
  contracts and has not been retained as an ingestion migration.
- [ ] Migrate or explicitly close legacy FCT and Ogun staging runs before a new
  jurisdiction is selected. Continue state population gradually through the
  skills without making it a dependency for account, privacy or commerce work.

### Cross River pause checkpoint

- [x] Store and review production evidence for the Calabar Free Trade Zone,
  preserving the historic assigned area and proposed extension separately while
  withholding boundary activation.
- [x] Store Marina Resort evidence, including the state-control record and a
  representative location point that is explicitly rejected as boundary
  geometry.
- [x] Store Obudu Mountain Resort, Becheve Nature Reserve and the federal
  approach-road right-of-way as independent assets. Preserve the 104/134 km²
  resort-area conflict and quarantine the 262-beacon ROW register pending
  rendered-page transcription.
- [x] Store Kwa Falls as four independent records: tourism site, waterfall/Great
  Kwa River corridor, historic oil-palm estate and federal irrigation project.
  Preserve the transposed coordinate labels and conflicting estate-area reports;
  do not infer any perimeter from them.
- [ ] On resumption, first decide whether to finish the statewide category
  inventory gate or formally replace that gate with the later approved
  one-subject-at-a-time protocol. Do not continue under contradictory rules.
- [ ] After that decision, select exactly one Cross River subject, run 10–15
  focused queries on that subject, present the evidence and data-quality limits,
  and wait for explicit approval before storing it or moving to another subject.

## Monetization — launch offering

The initial commercial offer should remain focused enough to explain clearly
and operate safely before accounts and organization workspaces exist.

### 1. Check Before You Pay

- [ ] Offer a free interactive preview that demonstrates the map and basic
  findings before payment.
- [ ] Sell an affordable preliminary land-risk check against Dende's currently
  available datasets.
- [ ] Provide a paid, permanent evidence report with a report ID, parcel map,
  findings, consulted source versions, coverage limitations, and timestamp.
- [ ] Clearly label the result as automated screening, not title verification
  or legal certification.

Initial price hypothesis: ₦2,500–₦5,000 for a preliminary check and
₦10,000–₦25,000 for a detailed evidence report. Validate willingness to pay
before fixing final prices.

### 2. Protect My Land

- [ ] Keep unverified, timestamped ownership notices free or low-cost to grow
  protective coverage and user-submitted conflict signals.
- [ ] Offer paid identity and document verification as an upgrade while
  preserving the distinction between submitted, reviewed, and
  authority-verified information.
- [ ] Offer recurring plot monitoring and conflict alerts after authentication
  and notification infrastructure is introduced.

Initial price hypothesis: ₦25,000–₦60,000 for identity/document verification
and ₦1,500–₦5,000 per plot monthly for monitoring.

### 3. Professional Due Diligence

- [ ] Offer a human-assisted case combining automated screening, survey and
  document review, source evidence, and a plain-language risk summary.
- [ ] Support optional surveyor, lawyer, and relevant-authority investigation,
  with each completed verification step recorded separately.
- [ ] Define required inputs, exclusions, turnaround time, reviewer role,
  escalation process, and customer deliverables before launch.

Initial price hypothesis: ₦75,000–₦250,000 depending on complexity, external
fees, and the verification depth requested.

### Confidence levels shown to customers

- [ ] **Automated screening:** checked only against the available datasets
  disclosed in the report.
- [ ] **Document reviewed:** submitted identity, title, and survey documents
  reviewed by the stated reviewer type.
- [ ] **Authority verified:** a recorded confirmation was obtained from the
  relevant government authority.

### Commercial launch prerequisites

- [x] Generate immutable evidence reports with permanent IDs, versioned JSON
  snapshots, SHA-256 integrity hashes, downloadable JSON and a print/PDF-ready
  public view. Report snapshots retain the exact plot, findings, consulted
  sources, coverage statement and disclaimer from the selected check run.
- [ ] Add a verification-request workflow, case status, internal review queue,
  evidence ledger, and service-delivery audit trail. A preliminary implementation
  was rejected and removed from the active product surface; redesign requires
  explicit approval before this item resumes.
- [ ] Define privacy, consent, sensitive-document retention, deletion, and
  reviewer-access policies.
- [ ] Add clear terms, coverage disclosures, liability boundaries, refund
  policy, turnaround commitments, and complaint handling.
- [x] Record versioned prices, orders, order lines, payment attempts, receipts,
  refunds, external fees and fulfilment status independently from check results.
  Checkout stays disabled until an approved price and payment integration exist.
- [ ] Validate the three launch offers with buyers, landholders, surveyors,
  lawyers, agents, and developers before automating the full purchase flow.

## Accounts, access, and introductory credits

Accounts should be optional while browsing and using the free preview. Users
may create an account directly or naturally during checkout or plot
protection. A newly eligible, verified account receives introductory credits
to run genuine preliminary checks before purchasing.

Dependency order: identity and sessions → contact verification and recovery →
resource ownership and permissions → operator/reviewer authorization → privacy
and retention enforcement → verification services → credits and commerce.

### Account model

- [x] Support verified individual accounts without forcing every public visitor
  to register.
- [ ] Let professionals register independently, with a separate credential
  status of unverified, pending, verified, rejected, suspended, or expired.
- [ ] Support organizations and memberships without reducing a person to one
  permanent user type.
- [ ] Give each private resource one accountable owner: either an individual
  user or an organization, with explicit collaborators and permissions.
- [ ] Preserve separate states for account identity, professional credentials,
  document review, claimed ownership review, and authority confirmation.
- [ ] Let legacy anonymous ownership notices be claimed using their private
  management key, with a manual recovery path when the key is unavailable.
- [ ] Use email or phone verification, secure sessions, recovery controls, and
  stronger confirmation for sensitive actions.

### Initial roles and permissions

- [ ] Define public visitor, individual, professional, organization member,
  Dende operator, and future authority-representative capabilities.
- [ ] Support organization owner, administrator, case manager, reviewer,
  billing, and read-only membership roles.
- [ ] Scope professional and organization access to assigned cases and record
  every sensitive read, review, export, and mutation in an audit trail.
- [ ] Never represent ownership of a Dende account record as legal ownership
  of the corresponding parcel.

### Introductory credit model

- [x] Grant three promotional credits once to an eligible verified new account.
  The idempotent grant is created after email verification, expires after 90
  days, and is also safely backfilled when an eligible account opens its wallet.
- [x] Charge one credit for a manual preliminary check and two credits for a
  survey-plan scan plus automated check. The API reserves before processing,
  consumes after success and releases after failure using request idempotency.
- [x] Keep plot-protection notices free during initial adoption; their dedicated
  intake bypasses the preliminary-check charge without granting paid features.
- [ ] Price detailed reports separately through additional credits or direct
  payment; keep human review, monitoring, and third-party authority fees
  outside promotional-credit spending unless explicitly enabled.
- [x] Store promotional and purchased value in separate ledger buckets, with
  product references and expiry metadata. Automated lot expiry, transfer and
  refund policy enforcement remain pending.
- [x] Reserve credits before costly processing, consume them only after success,
  and release reservations after failure or timeout. Expired reservations are
  reclaimed transactionally and idempotently during wallet use or through a
  protected worker endpoint, and cannot later be consumed.
- [x] Provide an immutable credit ledger capable of recording grants, purchases,
  reservations, consumption, release, refund, expiry, transfer and reasoned
  adjustments, with actor, product/reference, reversal and idempotency fields.
- [ ] Add verified-contact requirements, rate limits, duplicate-grant controls,
  device/payment risk signals, and reasoned administrative adjustments.
- [ ] Ensure free-credit results use the same checking quality and evidence
  disclosures as purchased preliminary checks.

## Identity and authorization schema plan

The schema should model people, organizations, roles, trust, and ownership as
separate concerns. Avoid a single `user_type` or mutable credit-balance column.

### Identity tables

- [x] Add `accounts.users` for stable user identity, lifecycle, preferred
  locale/timezone, and creation metadata; keep contact methods separate.
- [x] Add `accounts.identities` for normalized email/phone identifiers,
  verification status, verification timestamps, and uniqueness controls.
- [x] Add `accounts.sessions` and short-lived verification/recovery challenges
  with hashed secrets, expiry, revocation, device metadata, and last use.
- [x] Add email-verification and password-recovery challenge flows with hashed,
  30-minute, single-use links; enumeration-safe recovery responses; hourly
  issuance limits; development delivery outbox; password rehashing; audit events;
  and revocation of every active session after a password reset. Production email
  delivery remains an integration requirement.
- [ ] Add `accounts.professional_profiles` and immutable credential evidence,
  reviewer decisions, issuing body, jurisdiction, validity, and expiry.
- [ ] Add `accounts.organizations`, memberships, invitations, organization
  roles, membership lifecycle, and billing contact metadata.
- [x] Add the initial organization authorization layer: organizations,
  memberships, seven scoped roles, centralized permission mappings, seven-day
  email-matched invitations, individual-or-organization resource constraints,
  owner-only organization transfers and an immutable resource-ownership ledger.
  Billing contacts and organization lifecycle administration remain pending.

### Authorization and resource ownership

- [x] Attach plots, ownership notices and evidence reports created during an
  authenticated session to that individual account; preserve legacy and new
  anonymous records as explicitly unowned rather than guessing ownership. Add
  an owner-only My Records API/page and prevent non-owners from generating new
  reports for account-owned plots.
- [x] Define application permissions centrally and map them to system and
  organization roles. Dende system roles now use a separate permission map;
  internal intelligence routes authorize either scoped staff sessions or the
  dedicated automation credential.
- [ ] Add an explicit owner type/ID and creator to reports, cases, protected
  plot records, document submissions, monitoring rules, and orders.
- [ ] Add case-level collaborators with narrowly scoped view, edit, review,
  billing, and export permissions.
- [ ] Record actor, subject, organization, action, request context, before/after
  references, and timestamp in a tamper-evident audit-event stream.
- [x] Treat privileged Dende operator access as separately assigned and fully
  audited. Operator, reviewer, source-manager and support assignments have
  explicit start/revocation state and optional expiry; every allowed or denied
  privileged request enters an append-only access ledger. Administrative role
  provisioning UI and stronger step-up authentication remain pending.

### Credits and commerce tables

- [x] Add wallets scoped to a user or organization and denominated in credit
  units, without storing an authoritative mutable balance.
- [x] Add an append-only credit ledger with transaction type, quantity,
  promotional/purchased bucket, related product/order/check, idempotency key,
  expiry lot, reversal link, actor, reason, and timestamps.
- [x] Derive available, reserved, consumed and expired balances, including
  promotional/purchased subtotals, from ledger entries. Refundable-balance
  policy remains pending until purchased credits and payments are introduced.
- [x] Add products, versioned prices, orders, order lines, payment attempts,
  receipts, refunds, external fees, taxes, immutable order events and fulfilment
  records separately from credits and check evidence.
- [x] Require idempotency and database transactions for introductory grants,
  credit reservation, consumption and release. Payment callbacks and refunds
  remain pending with the commerce tables.

## Language, locale, and currency infrastructure

Internationalization should be foundational but incremental: begin with
English and Nigerian Naira while ensuring content, formatting, and commerce
records do not assume either is permanent.

### Language and locale

- [x] Use canonical BCP 47 locale identifiers such as `en-NG`, with runtime
  fallback from weighted request preference to organization preference, user
  preference, market default, and application default.
- [ ] Move user-interface copy, validation messages, emails, report labels, and
  notification templates into versioned translation keys. Product and initial
  authentication copy now use the versioned message store; remaining surfaces
  still require migration.
- [ ] Support pluralization, interpolation, localized dates/numbers, and future
  right-to-left layout without placing sentence fragments in translations.
- [ ] Store user-entered legal names, addresses, statements, source titles, and
  authority evidence in their original language; attach optional translations
  with language, translator/method, review status, and timestamp.
- [ ] Version report and legal/disclosure copy so historical reports retain the
  exact language and meaning presented when generated.
- [x] Start with `en-NG`; select the next languages from user research rather
  than assuming a translation order.

### Currency, pricing, and accounting

- [x] Store ISO 4217 currency codes and integer minor units in the versioned
  price foundation; floating-point monetary amounts are not accepted.
- [x] Store credit quantities as integer service units independent of money and
  currency, so one credit is not implicitly one Naira or one foreign unit.
- [ ] Version prices by product, market/country, currency, validity period, tax
  treatment, and sales channel. The versioned catalogue is implemented without
  inventing approved sale prices; order-time snapshots remain pending.
- [x] Keep display currency, charged currency, settlement currency, and ledger
  accounting currency explicit when they differ.
- [ ] Record exchange-rate source, rate, timestamp, direction, rounding, and
  converted amounts whenever conversion occurs; never recompute historical
  orders using a current rate.
- [x] Format currency through locale-aware presentation while preserving the
  stored currency code and exact minor-unit amount.
- [x] Begin the active Nigerian market with `NGN` and keep payment disabled;
  avoid multi-currency checkout until payment,
  refund, tax, reconciliation, and reporting behavior is verified per market.
- [ ] Keep third-party/authority fees as separately disclosed order lines rather
  than hiding them in Dende service pricing.

### International product configuration

- [x] Add extensible country/market configuration for supported locales,
  currency, default CRS and feature/payment configuration. Address formats,
  legal copy, tax rules and source-coverage bindings remain pending.
- [x] Use stable machine identifiers for products and translate presentation
  labels and explanations through versioned message keys.
- [ ] Test locale fallback, missing translations, plural rules, long text,
  right-to-left layout, currency rounding, zero-decimal currencies, refunds,
  and historical price/report reproduction before adding a new market.

## Later — accounts and commercial workflows

- [ ] Complete production account security: delivery integrations, rate limits,
  abuse controls, step-up authentication, privacy/retention enforcement and
  administrative provisioning.
- [ ] Add paid verification requests and professional review workflows.
- [ ] Add saved parcels, alerts, case ownership, and organization workspaces.
- [ ] Add professional subscriptions with bulk checks, case management,
  branded reports, exports, and team access.
- [ ] Add institutional/API access using usage-based or negotiated contracts.

## Current development constraint

Dende now has basic email/password accounts and revocable server-side sessions,
but email verification, recovery delivery, role-based authorization, account-
owned resources, rate limiting and abuse protection are not complete. It should
still be treated as a controlled development environment, not a public production
land registry. User-submitted notices are not proof of legal ownership, and clean
checks are limited to the datasets explicitly disclosed in their results.
