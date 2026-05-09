GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_device(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_device(uuid, uuid) TO authenticated, anon, service_role;