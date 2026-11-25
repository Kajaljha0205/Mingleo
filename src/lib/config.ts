// Product tunables (§11, §16). Keep CONNECT_DAILY_LIMIT in sync with send_connection_request() in 0004_discover.sql.
export const DISCOVER_WEIGHTS = { similarity: 0.8, distance: 0.2 } as const;
export const DISCOVER_BATCH = 30;
export const CONNECT_DAILY_LIMIT = 30;
export const REQUEST_COOLDOWN_DAYS = 30;
