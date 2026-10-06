-- Fail explicitly on legacy duplicates; never delete guest data implicitly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "waitlists" GROUP BY "event_id", lower(trim("email")) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate waitlist emails per event: reconcile duplicates before applying migration 0006';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "wait_event_email_unique" ON "waitlists" USING btree ("event_id",lower(trim("email")));
