
# Redesign completo — Glassmorphism Premium

Refaz a camada visual de todo o sistema sem alterar lógica de negócio, hooks, edge functions, schema de banco ou firmware. Todas as páginas existentes continuam funcionando exatamente como hoje — só mudam tokens, layout shell, componentes de UI e composição visual.

## 1. Design System (base de tudo)

Atualizar `src/index.css` e `tailwind.config.ts` com novos tokens semânticos (HSL):

- **Paleta**: azul primário mantido (217 91% 60%), com novo "primary-glow" (217 100% 70%) e accents complementares (cyan, violet sutil para gradientes).
- **Surfaces (glass)**:
  - `--glass-bg`: branco translúcido no light, slate translúcido no dark
  - `--glass-border`: borda sutil com alpha
  - `--glass-highlight`: brilho superior do card
- **Backgrounds com mesh**: gradiente radial multi-stop animado lentamente atrás de tudo (azul → cyan → violet com baixa opacidade), diferente para light/dark.
- **Tokens novos**:
  - `--gradient-mesh`, `--gradient-primary` (refinado), `--gradient-border` (para borda gradiente em cards de destaque)
  - `--shadow-glass`, `--shadow-elevated`, `--shadow-glow` (refinado)
  - `--blur-glass: 20px`
- **Tipografia**: importar Inter (400/500/600/700) e usar `font-display` com `tracking-tight` em headings.
- **Animações**: adicionar `fade-in`, `scale-in`, `slide-up`, `shimmer`, `float`, `glow-pulse` ao Tailwind config.

## 2. Componentes de UI base (variantes, não substituições)

Adicionar variantes glass aos componentes shadcn já usados, sem quebrar chamadas existentes:

- `Card`: nova classe utilitária `.glass-card` aplicada via prop `variant` (default mantém atual).
- `Button`: variantes novas `glass`, `premium` (gradiente + glow no hover).
- `Badge`: variantes `glass-success`, `glass-warning`, `glass-info`, `glass-destructive` com fundo translúcido + borda colorida.
- `Input`/`Select`/`Textarea`: tratamento glass (bg translúcido, borda sutil, focus ring com glow).
- Novo helper `src/components/ui/glass-panel.tsx` para painéis grandes.
- Novo `src/components/ui/animated-background.tsx` com mesh gradient animado para o shell.
- Novo `src/components/ui/stat-card.tsx` substituindo visualmente o `StatusCard` atual (mesma API: title, value, icon, variant, subtitle) com:
  - borda gradiente sutil
  - ícone em "pill" colorido
  - micro animação de entrada
  - sparkline opcional

## 3. App Shell (layout principal)

Redesenhar o shell em `src/App.tsx`:

- Topbar fixa com blur (sticky, backdrop-blur), contendo: SidebarTrigger, breadcrumb dinâmico (baseado na rota), busca global (placeholder visual), toggle de tema (sol/lua), `UserMenu`.
- Sidebar (`src/components/AppSidebar.tsx`) repaginada:
  - fundo glass no dark, contraste melhor no light
  - logo no topo com pequeno glow
  - itens com ícone em container, indicador ativo com barra gradiente + leve glow
  - separador "Admin" para itens `adminOnly`
  - rodapé com versão e status de conexão
- `AnimatedBackground` cobrindo a área de conteúdo (mesh gradient + grão sutil).
- Container de conteúdo com `max-w-7xl`, padding responsivo, animação de entrada por rota (`animate-fade-in`).

## 4. Toggle de tema

- Adicionar `next-themes` (já comum em projetos shadcn) ou implementar provider próprio simples em `src/components/ThemeProvider.tsx` com `localStorage` + classe `dark` no `<html>`.
- Componente `src/components/ThemeToggle.tsx` (Sun/Moon com transição suave) na topbar.
- Default: respeitar `prefers-color-scheme`.

## 5. Páginas — repaginação visual

Para cada página, manter 100% da lógica/dados/handlers; só mudar JSX/classes:

- **Dashboard** (`src/pages/Dashboard.tsx`): hero header com gradiente, novos `StatCard` em grid responsivo, painel "Backup em andamento" com barra de progresso animada e shimmer, "Status do Dispositivo" como lista com ícones em pílulas, "Atividade Recente" como timeline glass, charts dentro de glass-panel.
- **Backups** (`src/pages/Backups.tsx`): tabela em glass-card, badges glass para status/entrega, botões de ação em ícones com tooltip, painel lateral (`BackupDeliveryDetails`) já em sheet — repaginar com glass.
- **NetworkDestinations**, **DeliveryAgents**, **Logs**, **AdminDevices**, **Users**, **Profile**, **Settings**: mesmo tratamento — header consistente (título + descrição + ação primária), conteúdo em glass-panels, tabelas/listas com hover sutil.
- **Auth** (`src/pages/Auth.tsx`): split visual — lado esquerdo com mesh gradient + branding "T-Dongle S3 Monitor", direito com card glass de login.
- **NotFound**: visual coerente com glass + ilustração textual.

## 6. Microinterações

- Hover em cards: leve elevação (`translate-y-[-2px]`) + sombra glow.
- Itens de sidebar ativos: barra gradiente animada.
- Skeletons com shimmer real (gradiente animado).
- Toasts (sonner): tema customizado glass.
- Badges de status com pulse sutil quando "ativo/em tempo real".

## 7. Acessibilidade & responsividade

- Contraste AA garantido em ambos os temas (testar tokens glass com texto).
- Focus rings visíveis (ring com cor primária + offset).
- Sidebar colapsa para drawer em mobile (já usa shadcn sidebar — manter).
- Topbar e tabelas com tratamento mobile (scroll horizontal em tabelas, ações em menu).

## 8. Detalhes técnicos (seção para devs)

```text
Arquivos novos:
  src/components/ThemeProvider.tsx
  src/components/ThemeToggle.tsx
  src/components/ui/glass-panel.tsx
  src/components/ui/stat-card.tsx
  src/components/ui/animated-background.tsx
  src/components/AppTopbar.tsx
  src/components/RouteBreadcrumb.tsx

Arquivos editados (apenas visual):
  src/index.css                  → tokens glass, mesh, fontes, animações
  tailwind.config.ts             → keyframes/animation, fontFamily, novas cores semânticas
  src/App.tsx                    → shell com topbar + animated bg + ThemeProvider
  src/components/AppSidebar.tsx  → glass + indicador ativo + grupos
  src/components/StatusCard.tsx  → reusa stat-card por baixo (API mantida)
  src/pages/*.tsx                → repaginação JSX/classes, sem mudar lógica
  src/components/ui/{button,badge,card,input}.tsx → adicionar variantes glass

Sem alterações em:
  hooks/, integrations/, supabase/, agent/, utils/generateESP32Code.ts, schema do banco.
```

Dependência opcional: `next-themes` (leve, padrão em apps shadcn). Caso prefira evitar, uso provider próprio.

## Resultado esperado

Um sistema com identidade visual premium, glass coerente em todas as telas, suporte fluido a dark/light, microinterações sutis e zero regressão funcional.
