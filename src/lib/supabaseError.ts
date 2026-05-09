import { toast } from "sonner";

export type ParsedError = {
  title: string;
  message: string;
  code?: string;
  isPermission: boolean;
};

export function parseSupabaseError(error: unknown): ParsedError {
  const e = error as { message?: string; code?: string; details?: string; hint?: string } | null;
  const raw = e?.message ?? String(error ?? "");
  const code = e?.code;

  // Permission denied for function (e.g. has_role, can_access_device)
  const fnMatch = raw.match(/permission denied for function (\w+)/i);
  if (fnMatch) {
    return {
      title: "Acesso negado",
      message: `Você não tem permissão para usar a função "${fnMatch[1]}". Verifique seu papel ou peça acesso a um administrador.`,
      code: code ?? "42501",
      isPermission: true,
    };
  }

  // RLS violation on insert/update
  if (/violates row-level security policy/i.test(raw)) {
    return {
      title: "Permissão insuficiente",
      message: "Você não tem permissão para criar ou modificar este registro.",
      code: code ?? "42501",
      isPermission: true,
    };
  }

  // Permission denied for table
  const tableMatch = raw.match(/permission denied for (?:table|relation) (\w+)/i);
  if (tableMatch) {
    return {
      title: "Acesso negado",
      message: `Você não tem permissão para acessar "${tableMatch[1]}".`,
      code: code ?? "42501",
      isPermission: true,
    };
  }

  if (code === "42501") {
    return { title: "Acesso negado", message: "Operação não permitida pelo seu nível de acesso.", code, isPermission: true };
  }

  if (/jwt expired|invalid jwt|jwt malformed/i.test(raw)) {
    return { title: "Sessão expirada", message: "Faça login novamente para continuar.", code: "401", isPermission: true };
  }

  if (/duplicate key|unique constraint/i.test(raw)) {
    return { title: "Registro duplicado", message: "Já existe um registro com esses dados.", code: code ?? "23505", isPermission: false };
  }

  return {
    title: "Algo deu errado",
    message: raw || "Erro inesperado. Tente novamente.",
    code,
    isPermission: false,
  };
}

export function showSupabaseError(error: unknown, fallbackTitle?: string): ParsedError {
  const parsed = parseSupabaseError(error);
  toast.error(fallbackTitle ?? parsed.title, { description: parsed.message });
  return parsed;
}
