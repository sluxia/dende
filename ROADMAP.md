# Dende Roadmap

This is the canonical product and infrastructure roadmap for Dende. It reflects
the current implementation and should be updated whenever a material capability
is completed or reprioritized.

## Product direction

Dende helps people understand a parcel before buying, registering, or relying
on it. It converts survey plans and coordinates into mapped boundaries, checks
them against available spatial records, and clearly distinguishes official,
reference, user-submitted, and verified information.

The current priority is reliable infrastructure and transparent results. User
accounts, authentication, authorization, and public production access remain
deliberately deferred until the underlying data and audit workflows are stable.

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
- [ ] Add source filtering and coverage search.
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
- [ ] Rerun Cross River from the beginning under the spatial procedure — in
  progress; campaign and first 13 reserve/park inventory targets are stored.
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
- [x] Complete the first expanded Cross River discovery pass: 19 searchable
  events, 20 supporting documents, two acquired/checksummed official PDFs and
  six remaining file assets queued for acquisition or extraction.
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

- [ ] Generate immutable downloadable reports with permanent IDs.
- [ ] Add a verification-request workflow, case status, internal review queue,
  evidence ledger, and service-delivery audit trail.
- [ ] Define privacy, consent, sensitive-document retention, deletion, and
  reviewer-access policies.
- [ ] Add clear terms, coverage disclosures, liability boundaries, refund
  policy, turnaround commitments, and complaint handling.
- [ ] Record prices, orders, payments, receipts, refunds, external fees, and
  fulfilment status independently from check results.
- [ ] Validate the three launch offers with buyers, landholders, surveyors,
  lawyers, agents, and developers before automating the full purchase flow.

## Accounts, access, and introductory credits

Accounts should be optional while browsing and using the free preview. Users
may create an account directly or naturally during checkout or plot
protection. A newly eligible, verified account receives introductory credits
to run genuine preliminary checks before purchasing.

### Account model

- [ ] Support verified individual accounts without forcing every public visitor
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

- [ ] Grant three promotional credits once to an eligible verified new account.
- [ ] Initially charge one credit for a manual preliminary check and two credits
  for a survey-plan scan plus automated check.
- [ ] Keep plot-protection notices free during initial adoption.
- [ ] Price detailed reports separately through additional credits or direct
  payment; keep human review, monitoring, and third-party authority fees
  outside promotional-credit spending unless explicitly enabled.
- [ ] Store promotional and purchased value separately, including their expiry,
  refund, transfer, and permitted-product rules.
- [ ] Reserve credits before costly processing, consume them only after success,
  and automatically release reservations after failure or timeout.
- [ ] Record grants, purchases, reservations, consumption, release, refund,
  expiry, transfer, and administrative adjustment in an immutable ledger.
- [ ] Add verified-contact requirements, rate limits, duplicate-grant controls,
  device/payment risk signals, and reasoned administrative adjustments.
- [ ] Ensure free-credit results use the same checking quality and evidence
  disclosures as purchased preliminary checks.

## Identity and authorization schema plan

The schema should model people, organizations, roles, trust, and ownership as
separate concerns. Avoid a single `user_type` or mutable credit-balance column.

### Identity tables

- [ ] Add `accounts.users` for stable user identity, lifecycle, preferred
  locale/timezone, and creation metadata; keep contact methods separate.
- [ ] Add `accounts.identities` for normalized email/phone identifiers,
  verification status, verification timestamps, and uniqueness controls.
- [ ] Add `accounts.sessions` and short-lived verification/recovery challenges
  with hashed secrets, expiry, revocation, device metadata, and last use.
- [ ] Add `accounts.professional_profiles` and immutable credential evidence,
  reviewer decisions, issuing body, jurisdiction, validity, and expiry.
- [ ] Add `accounts.organizations`, memberships, invitations, organization
  roles, membership lifecycle, and billing contact metadata.

### Authorization and resource ownership

- [ ] Define application permissions centrally and map them to system and
  organization roles; do not scatter authorization assumptions through routes.
- [ ] Add an explicit owner type/ID and creator to reports, cases, protected
  plot records, document submissions, monitoring rules, and orders.
- [ ] Add case-level collaborators with narrowly scoped view, edit, review,
  billing, and export permissions.
- [ ] Record actor, subject, organization, action, request context, before/after
  references, and timestamp in a tamper-evident audit-event stream.
- [ ] Treat privileged Dende operator access as separately assigned, expiring
  where appropriate, and fully audited.

### Credits and commerce tables

- [ ] Add wallets scoped to a user or organization and denominated in credit
  units, without storing an authoritative mutable balance.
- [ ] Add an append-only credit ledger with transaction type, quantity,
  promotional/purchased bucket, related product/order/check, idempotency key,
  expiry lot, reversal link, actor, reason, and timestamps.
- [ ] Derive available, reserved, consumed, expired, and refundable balances
  from ledger entries or a rebuildable projection.
- [ ] Add products, versioned prices, orders, order lines, payment attempts,
  receipts, refunds, external fees, taxes, and fulfilment records separately
  from credits and check evidence.
- [ ] Require idempotency and database transactions for credit reservation,
  consumption, payment callbacks, refunds, and introductory grants.

## Language, locale, and currency infrastructure

Internationalization should be foundational but incremental: begin with
English and Nigerian Naira while ensuring content, formatting, and commerce
records do not assume either is permanent.

### Language and locale

- [ ] Use BCP 47 locale identifiers such as `en-NG`, with a documented fallback
  chain from user preference to organization preference, country default, and
  application default.
- [ ] Move user-interface copy, validation messages, emails, report labels, and
  notification templates into versioned translation keys rather than storing
  translated sentences in application logic.
- [ ] Support pluralization, interpolation, localized dates/numbers, and future
  right-to-left layout without placing sentence fragments in translations.
- [ ] Store user-entered legal names, addresses, statements, source titles, and
  authority evidence in their original language; attach optional translations
  with language, translator/method, review status, and timestamp.
- [ ] Version report and legal/disclosure copy so historical reports retain the
  exact language and meaning presented when generated.
- [ ] Start with `en-NG`; select the next languages from user research rather
  than assuming a translation order.

### Currency, pricing, and accounting

- [ ] Store ISO 4217 currency codes and integer minor units for monetary values;
  never use floating-point numbers for prices, payments, taxes, or refunds.
- [ ] Store credit quantities as integer service units independent of money and
  currency, so one credit is not implicitly one Naira or one foreign unit.
- [ ] Version prices by product, market/country, currency, validity period, tax
  treatment, and sales channel; snapshot the accepted price on every order.
- [ ] Keep display currency, charged currency, settlement currency, and ledger
  accounting currency explicit when they differ.
- [ ] Record exchange-rate source, rate, timestamp, direction, rounding, and
  converted amounts whenever conversion occurs; never recompute historical
  orders using a current rate.
- [ ] Format currency through locale-aware presentation while preserving the
  stored currency code and exact minor-unit amount.
- [ ] Begin with `NGN` pricing and avoid multi-currency checkout until payment,
  refund, tax, reconciliation, and reporting behavior is verified per market.
- [ ] Keep third-party/authority fees as separately disclosed order lines rather
  than hiding them in Dende service pricing.

### International product configuration

- [ ] Add country/market configuration for supported locales, currencies, CRS
  choices, address formats, legal copy, tax rules, products, prices, payment
  methods, source coverage, and feature availability.
- [ ] Use stable machine identifiers for products and findings; translate only
  presentation labels and explanations.
- [ ] Test locale fallback, missing translations, plural rules, long text,
  right-to-left layout, currency rounding, zero-decimal currencies, refunds,
  and historical price/report reproduction before adding a new market.

## Later — accounts and commercial workflows

- [ ] Implement the planned accounts, authentication, authorization, and roles
  after the schema and threat model are reviewed.
- [ ] Add paid verification requests and professional review workflows.
- [ ] Add saved parcels, alerts, case ownership, and organization workspaces.
- [ ] Add professional subscriptions with bulk checks, case management,
  branded reports, exports, and team access.
- [ ] Add institutional/API access using usage-based or negotiated contracts.

## Current development constraint

Dende has no user accounts or authentication. It should be treated as a
controlled development environment, not a public production land registry.
User-submitted notices are not proof of legal ownership, and clean checks are
limited to the datasets explicitly disclosed in their results.
