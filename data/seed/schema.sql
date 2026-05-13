-- =========================================================================
-- TADAT POC — UAE Federal Tax Authority — SQLite schema
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

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ---------------------------------------------------------------------------
-- 1. taxpayers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxpayers (
  trn                       TEXT PRIMARY KEY,            -- 15 digits, e.g. 100123456700003
  legal_name_en             TEXT NOT NULL,
  legal_name_ar             TEXT,
  entity_type               TEXT NOT NULL,               -- LLC | Sole Establishment | Free Zone | Branch | Govt | NPO | Individual
  segment                   TEXT NOT NULL,               -- Large | Medium | Small | Micro
  industry                  TEXT NOT NULL,
  emirate                   TEXT NOT NULL,
  free_zone                 TEXT,                        -- DMCC, JAFZA, DIFC, etc. (NULL if mainland)
  registration_date         TEXT NOT NULL,               -- ISO date
  status                    TEXT NOT NULL,               -- Active | Dormant | Deregistered | Suspended
  email                     TEXT,
  phone                     TEXT,
  address_line              TEXT,
  beneficial_owner_name     TEXT,                        -- For entities (P1-1-1 requirement)
  parent_group_trn          TEXT,                        -- Group registration link
  vat_registered            INTEGER NOT NULL DEFAULT 0,  -- 0/1
  excise_registered         INTEGER NOT NULL DEFAULT 0,
  ct_registered             INTEGER NOT NULL DEFAULT 0,
  vat_filing_frequency      TEXT,                        -- Monthly | Quarterly | NULL
  last_filing_date          TEXT,                        -- denormalized for fast non-filer queries
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  -- Quality flags used by Agent 1 (Registry Integrity)
  is_seeded_duplicate       INTEGER NOT NULL DEFAULT 0,  -- ground-truth flag
  is_seeded_dormant_mismatch INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_taxpayers_status      ON taxpayers (status);
CREATE INDEX IF NOT EXISTS idx_taxpayers_emirate     ON taxpayers (emirate);
CREATE INDEX IF NOT EXISTS idx_taxpayers_segment     ON taxpayers (segment);
CREATE INDEX IF NOT EXISTS idx_taxpayers_vat_reg     ON taxpayers (vat_registered);
CREATE INDEX IF NOT EXISTS idx_taxpayers_excise_reg  ON taxpayers (excise_registered);
CREATE INDEX IF NOT EXISTS idx_taxpayers_ct_reg      ON taxpayers (ct_registered);

-- ---------------------------------------------------------------------------
-- 2. declarations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS declarations (
  declaration_id        TEXT PRIMARY KEY,                -- e.g. VAT-2025-Q3-100123456700003
  trn                   TEXT NOT NULL REFERENCES taxpayers(trn),
  tax_type              TEXT NOT NULL CHECK (tax_type IN ('VAT','EXCISE','CT')),
  period_start          TEXT NOT NULL,
  period_end            TEXT NOT NULL,
  statutory_due_date    TEXT NOT NULL,
  filed_date            TEXT,                            -- NULL = not filed
  filing_channel        TEXT,                            -- Portal | API | Paper | NULL
  status                TEXT NOT NULL,                   -- Filed | NotFiled | Amended | Nil
  declared_tax_due      REAL NOT NULL DEFAULT 0,
  declared_refund       REAL NOT NULL DEFAULT 0,
  is_late               INTEGER NOT NULL DEFAULT 0,      -- derived flag for fast queries
  is_electronic         INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decl_trn                 ON declarations (trn);
CREATE INDEX IF NOT EXISTS idx_decl_tax_type_period     ON declarations (tax_type, period_end);
CREATE INDEX IF NOT EXISTS idx_decl_status              ON declarations (status);
CREATE INDEX IF NOT EXISTS idx_decl_due_date            ON declarations (statutory_due_date);

-- ---------------------------------------------------------------------------
-- 3. payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  payment_id            TEXT PRIMARY KEY,
  trn                   TEXT NOT NULL REFERENCES taxpayers(trn),
  tax_type              TEXT NOT NULL CHECK (tax_type IN ('VAT','EXCISE','CT')),
  linked_declaration_id TEXT REFERENCES declarations(declaration_id),
  statutory_due_date    TEXT NOT NULL,
  payment_date          TEXT NOT NULL,
  posted_date           TEXT NOT NULL,                  -- when posted to taxpayer ledger (TADAT P8-30 ≤1 business day = A)
  amount_aed            REAL NOT NULL,
  payment_method        TEXT NOT NULL,                   -- eDirham | DirectDebit | BankTransfer | Card | Cheque | Cash
  is_electronic         INTEGER NOT NULL DEFAULT 1,
  is_late               INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pay_trn                  ON payments (trn);
CREATE INDEX IF NOT EXISTS idx_pay_tax_type_due         ON payments (tax_type, statutory_due_date);
CREATE INDEX IF NOT EXISTS idx_pay_method               ON payments (payment_method);

-- ---------------------------------------------------------------------------
-- 4. arrears_ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS arrears_ledger (
  arrears_id            TEXT PRIMARY KEY,
  trn                   TEXT NOT NULL REFERENCES taxpayers(trn),
  tax_type              TEXT NOT NULL CHECK (tax_type IN ('VAT','EXCISE','CT')),
  source_declaration_id TEXT REFERENCES declarations(declaration_id),
  original_due_date     TEXT NOT NULL,
  principal_aed         REAL NOT NULL,
  accrued_penalty_aed   REAL NOT NULL DEFAULT 0,
  accrued_interest_aed  REAL NOT NULL DEFAULT 0,
  outstanding_total_aed REAL NOT NULL,
  age_days              INTEGER NOT NULL,
  age_bucket            TEXT NOT NULL,                  -- 0-30 | 31-90 | 91-365 | >365
  collectible_flag      INTEGER NOT NULL DEFAULT 1,     -- 0 if disputed / bankrupt / unreachable
  status                TEXT NOT NULL,                   -- Active | PaymentPlan | Disputed | WrittenOff | Paid
  fiscal_year           INTEGER NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_arr_trn               ON arrears_ledger (trn);
CREATE INDEX IF NOT EXISTS idx_arr_age_bucket        ON arrears_ledger (age_bucket);
CREATE INDEX IF NOT EXISTS idx_arr_collectible      ON arrears_ledger (collectible_flag);
CREATE INDEX IF NOT EXISTS idx_arr_fiscal_year     ON arrears_ledger (fiscal_year);

-- ---------------------------------------------------------------------------
-- 5. collections_summary  (annual rollup, 3 fiscal years for TADAT 3-year average)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collections_summary (
  fiscal_year                  INTEGER NOT NULL,
  tax_type                     TEXT NOT NULL,
  total_collected_aed          REAL NOT NULL,
  total_arrears_eoy_aed        REAL NOT NULL,
  collectible_arrears_eoy_aed  REAL NOT NULL,
  arrears_over_12mo_eoy_aed    REAL NOT NULL,
  PRIMARY KEY (fiscal_year, tax_type)
);

-- ---------------------------------------------------------------------------
-- 6. fta_aggregates  (raw real anchors from FTA open data)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fta_aggregates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year     INTEGER NOT NULL,
  metric          TEXT NOT NULL,                        -- e.g. 'vat_registrations', 'reconsiderations'
  value           INTEGER NOT NULL,
  source_file     TEXT NOT NULL,                        -- e.g. 'Selected Services Results.xlsx'
  source_url      TEXT,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_fta_agg_metric_year  ON fta_aggregates (metric, fiscal_year);

-- ---------------------------------------------------------------------------
-- 7. seed_run_log  (audit trail for reproducibility / eval)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seed_run_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at          TEXT NOT NULL DEFAULT (datetime('now')),
  rng_seed        INTEGER NOT NULL,
  taxpayer_count  INTEGER NOT NULL,
  notes           TEXT
);
