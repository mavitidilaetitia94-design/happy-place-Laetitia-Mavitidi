-- ============================================================
-- Fix RLS policies on public.news to allow managers and admins
-- to create and update published news as well as drafts.
-- ============================================================

DROP POLICY IF EXISTS "Manager insert own draft news" ON public.news;
DROP POLICY IF EXISTS "Manager update own draft news" ON public.news;
DROP POLICY IF EXISTS "Manager delete own draft news" ON public.news;

CREATE POLICY "Manager insert news" ON public.news
  FOR INSERT TO authenticated
  WITH CHECK (
    (private.current_app_role() = 'manager'::public.app_role OR private.is_admin())
    AND status IN ('brouillon'::public.news_status, 'publiée'::public.news_status, 'planifiée'::public.news_status)
    AND author_email = lower(auth.jwt() ->> 'email')
  );

CREATE POLICY "Manager update news" ON public.news
  FOR UPDATE TO authenticated
  USING (
    (private.current_app_role() = 'manager'::public.app_role OR private.is_admin())
    AND author_email = lower(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    (private.current_app_role() = 'manager'::public.app_role OR private.is_admin())
    AND status IN ('brouillon'::public.news_status, 'publiée'::public.news_status, 'planifiée'::public.news_status)
    AND author_email = lower(auth.jwt() ->> 'email')
  );

CREATE POLICY "Manager delete news" ON public.news
  FOR DELETE TO authenticated
  USING (
    (private.current_app_role() = 'manager'::public.app_role OR private.is_admin())
    AND author_email = lower(auth.jwt() ->> 'email')
  );
