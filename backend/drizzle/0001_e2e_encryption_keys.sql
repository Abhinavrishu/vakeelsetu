ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "encryption_public_key" text DEFAULT '';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "encrypted_private_key_backup" text DEFAULT '';
