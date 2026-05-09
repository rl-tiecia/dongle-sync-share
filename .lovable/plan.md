# Plano: Segurança, Auditoria e Gestão de Permissões

## 1. Testes automatizados de RLS (`has_role`, `can_edit_device`, `can_access_device`)

Criar uma edge function de teste **`rls-test-suite`** (executável apenas por admin) que:
- Cria 3 usuários temporários via Service Role: `admin_test`, `editor_test`, `viewer_test`
- Cria 1 device de teste, atribui permissões `editor` e `viewer`
- Para cada usuário, gera um JWT e executa um cliente Supabase com `anon key + Authorization: Bearer <jwt>` chamando:
  - `rpc('has_role', { _user_id, _role })` para cada role
  - `rpc('can_access_device', ...)` e `rpc('can_edit_device', ...)` no device de teste e em um device alheio
  - `SELECT` em `devices`, `device_backups`, `network_destinations` para confirmar visibilidade
  - `UPDATE` em `devices` para confirmar bloqueio do viewer
- Coleta resultados (esperado vs. obtido) e retorna JSON `{ passed, failed, details[] }`
- Limpa todos os recursos criados (rollback) ao final, mesmo em erro
- Acessível via botão "Rodar testes RLS" na nova tela de gestão (item 5)

## 2. Script de CI para validar GRANTs e policies

Criar `scripts/ci-rls-check.ts` (Deno) e `scripts/ci-rls-check.md`:
- Lê `supabase/migrations/*.sql` e extrai todas as `CREATE POLICY` e `GRANT EXECUTE`
- Confere via `supabase--read_query` (em runtime) ou via consulta a `pg_policies` / `pg_proc`:
  - Toda tabela em `public` tem RLS habilitada
  - Todas as funções `SECURITY DEFINER` referenciadas em policies têm `GRANT EXECUTE TO authenticated`
  - Nenhuma policy tem `USING (true)` para `SELECT` em tabelas com colunas sensíveis (lista configurável)
- Sai com código `1` se houver violação
- Documentação no `.md` explica como rodar localmente: `deno run --allow-net --allow-env scripts/ci-rls-check.ts` e como integrar em GitHub Actions (snippet YAML pronto)

## 3. Auditoria de acessos negados

Nova tabela **`access_audit_log`**:
- `user_id`, `function_name`, `resource_type`, `resource_id`, `granted` (bool), `reason`, `context` (jsonb), `created_at`
- RLS: somente admin pode ler; insert via SECURITY DEFINER

Nova função **`log_access_check(_user_id, _function, _resource_type, _resource_id, _granted, _reason)`** (SECURITY DEFINER) que insere no log.

Versões "auditadas" das funções existentes:
- `can_access_device_audited(_user_id, _device_id)` → chama `can_access_device` e registra resultado com motivo (`owner`, `permission`, `admin`, `denied:no_access`)
- `can_edit_device_audited(_user_id, _device_id)` → idem com motivos (`owner`, `editor_permission`, `admin`, `denied:viewer_only`, `denied:no_access`)

Estas funções **não substituem** as policies (para não impactar performance), mas podem ser invocadas explicitamente por edge functions sensíveis (ex: `device-backup-init`, `agent-claim-jobs`) para registrar tentativas.

## 4. Tratamento de erros claros para falhas de RLS/permissão

Criar utilitário frontend `src/lib/supabaseError.ts`:
- `parseSupabaseError(error)` → retorna `{ title, message, code, isPermission }`
- Detecta:
  - `42501` (insufficient privilege) → "Sem permissão para esta operação"
  - `permission denied for function X` → "Acesso negado à função X. Verifique seu papel."
  - `new row violates row-level security policy` → "Você não tem permissão para criar/editar este registro"
  - `JWT expired` → "Sessão expirada, faça login novamente"
- Hook `useSupabaseErrorToast()` que padroniza `toast.error(...)` em todas as chamadas
- Refatorar 4-5 chamadas críticas em `Backups.tsx`, `NetworkDestinations.tsx`, `DeliveryAgents.tsx`, `AdminDevices.tsx` para usar o helper

## 5. Tela de gestão de roles e permissões

Nova rota `/permissions` (admin only), no sidebar dentro do grupo "Admin":
- **Aba "Por Usuário"**: lista todos os usuários (`profiles` + `user_roles`), mostra:
  - Nome, email, role atual (badge)
  - Dropdown para mudar role (chama `update-user-role`)
  - Expansível: lista de devices que possui + devices compartilhados com ele
- **Aba "Por Dispositivo"**: lista todos os devices, mostra:
  - Nome, owner, lista de usuários compartilhados com nível
  - Botão para abrir `DeviceShareDialog` existente
- **Aba "Auditoria"**: tabela paginada do `access_audit_log` com filtros (usuário, função, granted/denied, range de data)
- **Aba "Testes RLS"**: botão "Rodar testes" → invoca `rls-test-suite` e mostra resultado em cards (verde/vermelho por caso)

## Arquivos novos
- `supabase/functions/rls-test-suite/index.ts`
- `supabase/migrations/<ts>_audit_log.sql` (tabela + funções auditadas)
- `scripts/ci-rls-check.ts` + `scripts/ci-rls-check.md`
- `src/lib/supabaseError.ts`
- `src/pages/Permissions.tsx`
- `src/components/permissions/UsersTab.tsx`
- `src/components/permissions/DevicesTab.tsx`
- `src/components/permissions/AuditTab.tsx`
- `src/components/permissions/RlsTestsTab.tsx`

## Arquivos editados
- `src/App.tsx` (rota `/permissions`)
- `src/components/AppSidebar.tsx` (item de menu)
- `src/integrations/supabase/types.ts` (auto)
- `supabase/config.toml` (registrar nova edge function)
- `src/pages/{Backups,NetworkDestinations,DeliveryAgents,AdminDevices}.tsx` (uso do helper de erros)

## Detalhes técnicos
- A edge function `rls-test-suite` usa **dois clientes**: um com `SERVICE_ROLE_KEY` para setup/teardown e outro com `ANON_KEY + Authorization` por usuário testado, para que as policies sejam realmente avaliadas.
- O script de CI usa o tool `supabase--read_query` em ambiente Lovable; fora do Lovable, fallback para `psql` via `PGHOST`.
- O `access_audit_log` tem índice em `(user_id, created_at DESC)` e `(function_name, granted)`.
- A tela `/permissions` reaproveita componentes glass do design system atual.
