-- Phase 3 migration: add priority column to work_orders table
-- Run this in the Supabase SQL editor before using the Phase 3 work order features.

ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
