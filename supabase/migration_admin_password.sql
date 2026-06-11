-- =========================================================
-- WikiFEDUC — Migración: login de admin con contraseña
-- Ejecutar en: Supabase SQL Editor → New query → Run
-- =========================================================

-- false = el admin aún no crea su contraseña (primer login pendiente)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS password_creada boolean NOT NULL DEFAULT false;
