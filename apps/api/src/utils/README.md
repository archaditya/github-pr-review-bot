# src/utils/

Pure helper functions only — no side effects, no imports from `services/`, `repositories/`,
or `integrations/` (utils are the lowest layer, everything can depend on them, they depend on
nothing internal).

Examples: pagination helpers (cursor-based, per prior project convention), date formatting,
structured logger instance.
