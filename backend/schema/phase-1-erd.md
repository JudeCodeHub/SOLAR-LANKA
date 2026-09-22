# Phase 1 entity relationship diagram

Draft logical model; this diagram does not create database tables. Attributes focus on identifiers, ownership, and important constraints. Clerk owns authentication sessions; `APP_USER` stores application identity and status, not passwords or login sessions.

```mermaid
erDiagram
    APP_USER ||--o{ COMPANY_MEMBERSHIP : belongs_through
    COMPANY ||--o{ COMPANY_MEMBERSHIP : has_members
    COMPANY ||--o{ COMPANY_REVIEW : receives
    APP_USER ||--o{ COMPANY_REVIEW : reviews
    PRODUCT ||--o| PANEL : panel_specifications
    PRODUCT ||--o| INVERTER : inverter_specifications
    PRODUCT ||--o{ PRODUCT_DOCUMENT : has_documents
    ATTACHMENT o|--o{ PRODUCT_DOCUMENT : supplies_file
    PRODUCT ||--o{ PRODUCT_OFFER : offered_as
    COMPANY ||--o{ PRODUCT_OFFER : owns
    APP_USER ||--o{ FAVOURITE : owns
    PRODUCT ||--o{ FAVOURITE : saved_as
    APP_USER o|--o{ CALCULATION_CONFIGURATION : publishes
    CALCULATION_CONFIGURATION ||--o{ SAVED_ESTIMATE : used_for
    APP_USER ||--o{ SAVED_ESTIMATE : owns
    APP_USER ||--o{ QUOTATION_REQUEST : owns
    SAVED_ESTIMATE o|--o{ QUOTATION_REQUEST : optionally_informs
    QUOTATION_REQUEST ||--|{ REQUEST_RECIPIENT : delivered_as
    COMPANY ||--o{ REQUEST_RECIPIENT : receives
    REQUEST_RECIPIENT ||--o{ COMPANY_NOTE : contains_private_notes
    APP_USER ||--o{ COMPANY_NOTE : authors
    REQUEST_RECIPIENT ||--o{ QUOTATION : receives_offers
    QUOTATION ||--|{ QUOTATION_REVISION : has_revisions
    APP_USER ||--o{ QUOTATION_REVISION : authors
    QUOTATION_REVISION ||--o{ QUOTATION_LINE_ITEM : contains
    PRODUCT o|--o{ QUOTATION_LINE_ITEM : optionally_references
    QUOTATION_REQUEST ||--o| QUOTATION_ACCEPTANCE : has_one_winner
    QUOTATION_REVISION ||--o| QUOTATION_ACCEPTANCE : exact_accepted_revision
    APP_USER ||--o{ QUOTATION_ACCEPTANCE : accepts
    QUOTATION_ACCEPTANCE ||--|| INSTALLATION : creates_atomically
    INSTALLATION ||--|{ INSTALLATION_MILESTONE : tracks
    INSTALLATION_MILESTONE ||--o{ MILESTONE_UPDATE : records_history
    APP_USER ||--o{ MILESTONE_UPDATE : authors
    APP_USER ||--o{ ATTACHMENT : uploads
    COMPANY o|--o{ ATTACHMENT : scopes
    QUOTATION_REVISION o|--o{ ATTACHMENT : has_documents
    INSTALLATION o|--o{ ATTACHMENT : has_documents
    MILESTONE_UPDATE o|--o{ ATTACHMENT : has_evidence
    APP_USER ||--o{ NOTIFICATION : receives
    OUTBOX_EVENT ||--o{ NOTIFICATION : produces
    APP_USER o|--o{ AUDIT_EVENT : acts
    COMPANY o|--o{ AUDIT_EVENT : scopes

    APP_USER {
        uuid id PK
        string clerk_subject UK
        string platform_role
        string account_status
    }
    COMPANY {
        uuid id PK
        string name
        string publication_status
    }
    COMPANY_MEMBERSHIP {
        uuid id PK
        uuid user_id FK
        uuid company_id FK
        string role
        string status
    }
    COMPANY_REVIEW {
        uuid id PK
        uuid company_id FK
        uuid reviewer_id FK
        string decision
        datetime reviewed_at
    }
    PRODUCT {
        uuid id PK
        string kind
        string brand
        string model
        string source_url
        datetime verified_at
    }
    PANEL {
        uuid product_id PK,FK
        decimal wattage
        decimal efficiency
    }
    INVERTER {
        uuid product_id PK,FK
        string category
        decimal capacity_kw
    }
    PRODUCT_DOCUMENT {
        uuid id PK
        uuid product_id FK
        uuid attachment_id FK "nullable for external documents"
        string source_url
    }
    PRODUCT_OFFER {
        uuid id PK
        uuid company_id FK
        uuid product_id FK
        decimal indicative_price
        string currency
    }
    FAVOURITE {
        uuid user_id PK,FK
        uuid product_id PK,FK
    }
    CALCULATION_CONFIGURATION {
        uuid id PK
        int version UK
        uuid publisher_id FK
        json assumptions_and_sources
        string status
    }
    SAVED_ESTIMATE {
        uuid id PK
        uuid customer_id FK
        uuid configuration_id FK
        json input_snapshot
        json configuration_snapshot
        json result_snapshot
    }
    QUOTATION_REQUEST {
        uuid id PK
        uuid customer_id FK
        uuid saved_estimate_id FK "optional"
        string submission_key
        string status
    }
    REQUEST_RECIPIENT {
        uuid id PK
        uuid request_id FK
        uuid company_id FK
        string status
    }
    COMPANY_NOTE {
        uuid id PK
        uuid recipient_id FK
        uuid author_id FK
        string body
    }
    QUOTATION {
        uuid id PK
        uuid recipient_id FK
    }
    QUOTATION_REVISION {
        uuid id PK
        uuid quotation_id FK
        uuid author_id FK
        int revision_number
        string status
        datetime valid_until
        datetime sent_at
        decimal total
        json terms_snapshot
    }
    QUOTATION_LINE_ITEM {
        uuid id PK
        uuid revision_id FK
        uuid product_id FK "optional for labour and other charges"
        json equipment_snapshot
        decimal quantity
        decimal unit_price
        decimal total
    }
    QUOTATION_ACCEPTANCE {
        uuid id PK
        uuid request_id FK,UK
        uuid revision_id FK,UK
        uuid accepted_by_id FK
        datetime accepted_at
    }
    INSTALLATION {
        uuid id PK
        uuid acceptance_id FK,UK
        string status
    }
    INSTALLATION_MILESTONE {
        uuid id PK
        uuid installation_id FK
        int sequence
        string status
        json evidence_requirements
    }
    MILESTONE_UPDATE {
        uuid id PK
        uuid milestone_id FK
        uuid actor_id FK
        string visibility
        string reason
        string next_action
        datetime created_at
    }
    ATTACHMENT {
        uuid id PK
        uuid uploader_id FK
        uuid company_id FK "optional"
        uuid revision_id FK "optional parent"
        uuid installation_id FK "optional parent"
        uuid milestone_update_id FK "optional parent"
        string storage_identifier UK
        string visibility
    }
    OUTBOX_EVENT {
        uuid id PK
        string event_key UK
        string event_type
        json payload
        datetime processed_at
    }
    NOTIFICATION {
        uuid id PK
        uuid recipient_user_id FK
        uuid event_id FK
        string kind
        datetime read_at
    }
    AUDIT_EVENT {
        uuid id PK
        uuid actor_id FK "nullable for system events"
        uuid company_id FK "optional"
        string target_type
        uuid target_id "historical identifier"
        string action
        datetime created_at
    }
```

## Ownership and consistency rules

- **Memberships:** unique `(company_id, user_id)`. Company permissions come from active membership and its role; platform permissions are separate. Public registration cannot choose privileged roles.
- **Products:** `PRODUCT` is a proposed shared identity for panels and inverters, making offers, favourites, and documents reference a real foreign key. Each product must have exactly the subtype matching its kind. Company prices remain in `PRODUCT_OFFER`.
- **Customer records:** estimates and requests belong to their customer. A linked estimate must belong to that same customer. Uniqueness on `(customer_id, submission_key)` prevents duplicate request submission.
- **Recipient isolation:** unique `(request_id, company_id)`. Every quotation and internal note belongs to one recipient delivery. Company ownership follows that delivery; companies cannot see competing deliveries, quotations, or notes. Authors must have authorised membership at the time of the action.
- **Revisions:** unique `(quotation_id, revision_number)`. A quotation starts with a draft revision; sent content, line items, prices, and terms become immutable snapshots. Lifecycle state may change only through validated transitions. Later product edits never rewrite sent offers.
- **Acceptance:** unique `request_id` permits one winner. The accepted revision must trace through its quotation and recipient to that request, and the accepting user must own it. Eligibility, matching relationships, concurrency protection, and creation of one installation must be enforced in one transaction; foreign keys alone cannot establish those cross-table rules.
- **Installation ownership:** customer and company are derived from the accepted revision's request/recipient chain, avoiding conflicting duplicated ownership. Milestone updates retain actor/time/reason and distinguish internal notes from customer-visible updates.
- **Files:** private attachments require exactly one authorised parent among revision, installation, and milestone update. Public product documents use `PRODUCT_DOCUMENT`; an external document may instead carry a source URL. Validate company scope against the parent. Uploader identity or possession of a storage identifier does not grant download access.
- **Estimates:** published configurations are immutable versions. Saved input/configuration/result snapshots preserve the original calculation even after a new version is published. Draft configurations may have no publisher yet; the publisher relationship is required on publication.
- **Notifications:** unique `(event_id, recipient_user_id, kind)` prevents duplicate processing. Write required outbox events with the business transaction; notification destination links still require authorisation.
- **History:** archive referenced users, companies, and products instead of cascading deletion through quotations or installations. Audit targets are historical identifiers, not an unrestricted access mechanism. Milestone sequence is unique within an installation.

`PRODUCT`, `QUOTATION_ACCEPTANCE`, `COMPANY_NOTE`, `MILESTONE_UPDATE`, and `OUTBOX_EVENT` are proposed supporting entities for the scoped workflows. Detailed fields, indexes, and enforcement mechanisms will be refined in their implementation steps. Education, visits, technician assignments, support cases, and translations belong to later releases and are not included here.
