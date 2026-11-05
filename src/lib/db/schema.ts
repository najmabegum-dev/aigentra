import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  char,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

// 1. Workspaces
export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  aiCallsUsed: integer("ai_calls_used").default(0).notNull(),
  killSwitch: boolean("kill_switch").default(false).notNull(),
});

// 2. Policies
export const policies = pgTable("policies", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 3. Policy Versions (Immutable version history)
export const policyVersions = pgTable(
  "policy_versions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    policyId: text("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    rulesJson: jsonb("rules_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("uq_policy_versions_policy_version").on(table.policyId, table.version),
  ]
);

// 4. Intents
export const intents = pgTable("intents", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  rawText: text("raw_text").notNull(),
  parsedJson: jsonb("parsed_json"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 5. Proposals
export const proposals = pgTable("proposals", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  intentId: text("intent_id").references(() => intents.id, { onDelete: "set null" }),
  itemsJson: jsonb("items_json").notNull(),
  totalCents: integer("total_cents").notNull(),
  currency: char("currency", { length: 3 }).default("USD").notNull(),
  proposalHash: text("proposal_hash").notNull(),
  state: text("state").notNull(),
  policyVersionId: text("policy_version_id").references(() => policyVersions.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 6. Evaluations
export const evaluations = pgTable("evaluations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => proposals.id, { onDelete: "cascade" }),
  policyVersionId: text("policy_version_id")
    .notNull()
    .references(() => policyVersions.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  ruleResultsJson: jsonb("rule_results_json").notNull(),
  reasonCodes: jsonb("reason_codes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 7. Mandates (Single-use, expiring)
export const mandates = pgTable("mandates", {
  jti: text("jti").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => proposals.id, { onDelete: "cascade" }),
  propHash: text("prop_hash").notNull(),
  policyVersionId: text("policy_version_id")
    .notNull()
    .references(() => policyVersions.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  currency: char("currency", { length: 3 }).default("USD").notNull(),
  grant: text("grant").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// 8. Spend Reservations
export const spendReservations = pgTable("spend_reservations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => proposals.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  currency: char("currency", { length: 3 }).default("USD").notNull(),
  state: text("state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 9. PayPal Orders (Anchored to proposal_hash in custom_id)
export const paypalOrders = pgTable(
  "paypal_orders",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    paypalOrderId: text("paypal_order_id").notNull(),
    status: text("status").notNull(),
    requestId: text("request_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).default("USD").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("uq_paypal_orders_proposal_id").on(table.proposalId),
    unique("uq_paypal_orders_paypal_order_id").on(table.paypalOrderId),
  ]
);

// 10. PayPal Captures
export const paypalCaptures = pgTable(
  "paypal_captures",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => paypalOrders.id, { onDelete: "cascade" }),
    captureId: text("capture_id").notNull(),
    status: text("status").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).default("USD").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("uq_paypal_captures_capture_id").on(table.captureId)]
);

// 11. Webhook Events (Dedupe by primary key paypal_event_id)
export const webhookEvents = pgTable("webhook_events", {
  paypalEventId: text("paypal_event_id").primaryKey(),
  workspaceId: text("workspace_id"),
  eventType: text("event_type").notNull(),
  verified: boolean("verified").default(false).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  payloadHash: text("payload_hash").notNull(),
  payloadJson: jsonb("payload_json").notNull(),
});

// 12. Ledger Events (Hash chained audit trail)
export const ledgerEvents = pgTable(
  "ledger_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    type: text("type").notNull(),
    actor: text("actor").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    prevHash: text("prev_hash").notNull(),
    eventHash: text("event_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("uq_ledger_events_workspace_seq").on(table.workspaceId, table.seq),
  ]
);

// 13. Attack Runs (Adversarial test verification)
export const attackRuns = pgTable("attack_runs", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  scenario: text("scenario").notNull(),
  expected: text("expected").notNull(),
  actual: text("actual").notNull(),
  paypalRequestsBefore: integer("paypal_requests_before").notNull(),
  paypalRequestsAfter: integer("paypal_requests_after").notNull(),
  passed: boolean("passed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 14. AI Usage (Per-workspace caps)
export const aiUsage = pgTable("ai_usage", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  tokens: integer("tokens").notNull(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
});
