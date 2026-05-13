-- =========================================================================
-- TADAT POC — UAE Federal Tax Authority — Postgres schema (Supabase host)
-- =========================================================================
-- Designed to mirror what an FTA's IT subsystems actually hold:
--   * Taxpayer Registration (POA 1, TADAT Box 1)
--   * Filing & Declaration Processing (POA 4, TADAT Box 5)
--   * Tax Revenue Accounting (POA 8, TADAT Box 11)
--   * Arrears Management (POA 5, TADAT Box 6)
--
-- Source taxes (UAE FTA scope):
--   * VAT       — 5%, monthly/quarterly filing, due 28th of month after period
--   * EXCISE    — 50% / 100% on specific goods, monthly, due 15th
--   * CT        — Corporate Tax 9%, annual, due 9 months after FY end
-- Note: UAE has no PIT / PAYE.
-- =========================================================================
--
-- We use plain Postgres types and BOOLEAN where SQLite had INTEGER 0/1 flags.
-- Dates are stored as DATE (was TEXT ISO in SQLite). Money is NUMERIC(20,2)
-- to avoid float drift. The schema is idempotent: drop + re-create on every
-- init so re-seeding is a one-command op.

DROP TABLE IF EXISTS seed_run_log         CASCADE;
DROP TABLE IF EXISTS fta_aggregates       CASCADE;
DROP TABLE IF EXISTS collections_summary  CASCADE;
DROP TABLE IF EXISTS arrears_ledger       CASCADE;
DROP TABLE IF EXISTS payments             CASCADE;
DROP TABLE IF EXISTS declarations         CASCADE;
DROP TABLE IF EXISTS taxpayers            CASCADE;

-- ---------------------------------------------------------------------------
-- 1. taxpayers
-- ---------------------------------------------------------------------------
CREATE TABLE taxpayers (
  trn                         TEXT PRIMARY KEY,            -- 15 digits
  legal_name_en               TEXT NOT NULL,
  legal_name_ar               TEXT,
  entity_type                 TEXT NOT NULL,
  segment                     TEXT NOT NULL,
  industry                    TEXT NOT NULL,
  emirate                     TEXT NOT NULL,
  free_zone                   TEXT,
  registration_date           DATE NOT NULL,
  status                      TEXT NOT NULL,
  email                       TEXT,
  phone                       TEXT,
  address_line                TEXT,
  beneficial_owner_name       TEXT,
  parent_group_trn            TEXT,
  vat_registered              BOOLEAN NOT NULL DEFAULT FALSE,
  excise_registered           BOOLEAN NOT NULL DEFAULT FALSE,
  ct_registered               BOOLEAN NOT NULL DEFAULT FALSE,
  vat_filing_frequency        TEXT,
  last_filing_date            DATE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_seeded_duplicate         BOOLEAN NOT NULL DEFAULT FALSE,
  is_seeded_dormant_mismatch  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_taxpayers_status      ON taxpayers (status);
CREATE INDEX idx_taxpayers_emirate     ON taxpayers (emirate);
CREATE INDEX idx_taxpayers_segment     ON taxpayers (segment);
CREATE INDEX idx_taxpayers_vat_reg     ON taxpayers (vat_registered);
CREATE INDEX idx_taxpayers_excise_reg  ON taxpayers (excise_registered);
CREATE INDEX idx_taxpayers_ct_reg      ON taxpayers (ct_registered);

-- ---------------------------------------------------------------------------
-- 2. declarations
-- ---------------------------------------------------------------------------
CREATE TABLE declarations (
  declaration_id        TEXT PRIMARY KEY,
  trn                   TEXT NOT NULL REFERENCES taxpayers(trn),
  tax_type              TEXT NOT NULL CHECK (tax_type IN ('VAT','EXCISE','CT')),
  period_start          DATE NOT NULL,
  period_end            DATE NOT NULL,
  statutory_due_date    DATE NOT NULL,
  filed_date            DATE,
  filing_channel        TEXT,
  status                TEXT NOT NULL,
  declared_tax_due      NUMERIC(20,2) NOT NULL DEFAULT 0,
  declared_refund       NUMERIC(20,2) NOT NULL DEFAULT 0,
  is_late               BOOLEAN NOT NULL DEFAULT FALSE,
  is_electronic         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decl_trn               ON declarations (trn);
CREATE INDEX idx_decl_tax_type_period   ON declarations (tax_type, period_end);
CREATE INDEX idx_decl_status            ON declarations (status);
CREATE INDEX idx_decl_due_date          ON declarations (statutory_due_date);

-- ---------------------------------------------------------------------------
-- 3. payments
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
  payment_id            TEXT PRIMARY KEY,
  trn                   TEXT NOT NULL REFERENCES taxpayers(trn),
  tax_type              TEXT NOT NULL CHECK (tax_type IN ('VAT','EXCISE','CT')),
  linked_declaration_id TEXT REFERENCES declarations(declaration_id),
  statutory_due_date    DATE NOT NULL,
  payment_date          DATE NOT NULL,
  posted_date           DATE NOT NULL,
  amount_aed            NUMERIC(20,2) NOT NULL,
  payment_method        TEXT NOT NULL,
  is_electronic         BOOLEAN NOT NULL DEFAULT TRUE,
  is_late               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pay_trn          ON payments (trn);
CREATE INDEX idx_pay_tax_type_due ON payments (tax_type, statutory_due_date);
CREATE INDEX idx_pay_method       ON payments (payment_method);

-- ---------------------------------------------------------------------------
-- 4. arrears_ledger
-- ---------------------------------------------------------------------------
CREATE TABLE arrears_ledger (
  arrears_id            TEXT PRIMARY KEY,
  trn                   TEXT NOT NULL REFERENCES taxpayers(trn),
  tax_type              TEXT NOT NULL CHECK (tax_type IN ('VAT','EXCISE','CT')),
  source_declaration_id TEXT REFERENCES declarations(declaration_id),
  original_due_date     DATE NOT NULL,
  principal_aed         NUMERIC(20,2) NOT NULL,
  accrued_penalty_aed   NUMERIC(20,2) NOT NULL DEFAULT 0,
  accrued_interest_aed  NUMERIC(20,2) NOT NULL DEFAULT 0,
  outstanding_total_aed NUMERIC(20,2) NOT NULL,
  age_days              INTEGER NOT NULL,
  age_bucket            TEXT NOT NULL,
  collectible_flag      BOOLEAN NOT NULL DEFAULT TRUE,
  status                TEXT NOT NULL,
  fiscal_year           INTEGER NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_arr_trn          ON arrears_ledger (trn);
CREATE INDEX idx_arr_age_bucket   ON arrears_ledger (age_bucket);
CREATE INDEX idx_arr_collectible  ON arrears_ledger (collectible_flag);
CREATE INDEX idx_arr_fiscal_year  ON arrears_ledger (fiscal_year);

-- ---------------------------------------------------------------------------
-- 5. collections_summary
-- ---------------------------------------------------------------------------
CREATE TABLE collections_summary (
  fiscal_year                  INTEGER NOT NULL,
  tax_type                     TEXT NOT NULL,
  total_collected_aed          NUMERIC(20,2) NOT NULL,
  total_arrears_eoy_aed        NUMERIC(20,2) NOT NULL,
  collectible_arrears_eoy_aed  NUMERIC(20,2) NOT NULL,
  arrears_over_12mo_eoy_aed    NUMERIC(20,2) NOT NULL,
  PRIMARY KEY (fiscal_year, tax_type)
);

-- ---------------------------------------------------------------------------
-- 6. fta_aggregates
-- ---------------------------------------------------------------------------
CREATE TABLE fta_aggregates (
  id              SERIAL PRIMARY KEY,
  fiscal_year     INTEGER NOT NULL,
  metric          TEXT NOT NULL,
  value           BIGINT NOT NULL,
  source_file     TEXT NOT NULL,
  source_url      TEXT,
  notes           TEXT
);

CREATE INDEX idx_fta_agg_metric_year ON fta_aggregates (metric, fiscal_year);

-- ---------------------------------------------------------------------------
-- 7. seed_run_log
-- ---------------------------------------------------------------------------
CREATE TABLE seed_run_log (
  id              SERIAL PRIMARY KEY,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rng_seed        BIGINT NOT NULL,
  taxpayer_count  INTEGER NOT NULL,
  notes           TEXT
);
