// Re-export the shared Excel utility functions from the Mercado Livre implementation
// This keeps existing imports (e.g., '@/app/full-replenishment/excel-utils') functional
// while allowing separate implementations per marketplace if needed in the future.
export * from "./meli/excel-utils";
