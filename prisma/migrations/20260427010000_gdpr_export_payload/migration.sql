-- Add inline JSON payload column to DataExportRequest so completed exports can
-- be served from Postgres (Railway has no persistent FS).
ALTER TABLE "DataExportRequest" ADD COLUMN "payloadJson" JSONB;
