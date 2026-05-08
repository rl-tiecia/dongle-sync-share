import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, ShieldCheck, Activity, Cloud } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const authSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email muito longo"),
  password: z
    .string()
    .min(10, "Senha deve ter no mínimo 10 caracteres")
    .max(128, "Senha muito longa")
    .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter pelo menos um número"),
});

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async (values: z.infer<typeof authSchema>) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
    setLoading(false);
    if (error) toast({ title: "Erro no login", description: error.message, variant: "destructive" });
  };

  return (
    <div className="relative min-h-screen mesh-bg overflow-hidden">
      <div className="absolute inset-0 bg-gradient-mesh animate-mesh-shift" style={{ backgroundSize: "200% 200%" }} />

      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* Left brand */}
        <div className="hidden lg:flex flex-col justify-between p-12 relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
              <Zap className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-bold text-lg gradient-text">T-Dongle S3</p>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Monitor</p>
            </div>
          </div>

          <div className="space-y-8 max-w-md">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              Backup automático,<br />
              <span className="gradient-text">monitorado em tempo real.</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Centralize seus dispositivos LilyGO T-Dongle S3, acompanhe transferências e entregas em qualquer destino de rede.
            </p>
            <div className="space-y-3">
              {[
                { icon: Activity, label: "Telemetria em tempo real" },
                { icon: Cloud, label: "Cloud Storage + agente local" },
                { icon: ShieldCheck, label: "Validação MD5 e RLS" },
              ].map(({ icon: I, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <I className="h-4 w-4" />
                  </div>
                  <span className="text-foreground/80">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} T-Dongle Monitor</p>
        </div>

        {/* Right form */}
        <div className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md animate-scale-in">
            <div className="glass-card p-8 shadow-elevated">
              <div className="mb-6 lg:hidden flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <p className="font-bold gradient-text">T-Dongle Monitor</p>
              </div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold">Bem-vindo de volta</h2>
                <p className="text-sm text-muted-foreground mt-1">Acesse sua conta para gerenciar dispositivos</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSignIn)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="seu@email.com" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-primary hover:opacity-90 shadow-glow transition-all"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              </Form>

              <p className="text-xs text-muted-foreground text-center mt-6">
                Para criar uma conta, solicite um convite ao administrador
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
