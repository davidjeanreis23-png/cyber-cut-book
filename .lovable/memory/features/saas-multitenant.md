---
name: SaaS multi-tenant
description: Arquitetura multi-tenant com tabela tenants, role master, RLS por tenant_id, trial de 5 dias e bloqueio
type: feature
---
# Multi-tenant SaaS (Fase 1)

## Tabela `tenants`
Cada barbearia cliente do SaaS. Campos: name, owner_name, email, phone, cpf_cnpj, address, city, state, status (trial/active/blocked/cancelled), plan (default 'pro'), plan_price (R$ 39,00), trial_start, trial_end (+5 dias auto via trigger `set_tenant_trial_defaults`), subscription_id, paid_until.

## Roles
- `user` — cliente que agenda
- `admin` — dono da barbearia (gerencia seu tenant)
- `master` — dono do SaaS (vê tudo, gerencia tenants). Master inicial: davidjeanreis.29@gmail.com

## Vínculo tenant_id
Adicionado em: profiles, barbers, services, appointments, settings.
Função: `get_user_tenant_id(uuid)` — pega tenant_id do profile do usuário logado.

## RLS
- Cada admin/user só vê dados onde `tenant_id = get_user_tenant_id(auth.uid())`
- Master enxerga tudo (`has_role(auth.uid(), 'master')`)
- Tabela `tenants`: só master pode ler/escrever

## Frontend
- Hook `useAuth` expõe `isMaster` e `tenant` (status + trial_end)
- `ProtectedRoute` em App.tsx redireciona para `/blocked` se status = blocked/cancelled OU trial vencido (master imune)
- Página `/master` com sidebar tema azul/roxo (Crown icon, label "MASTER")
- Página `/blocked` com botão assinar (chama edge `create-subscription`) e WhatsApp suporte 5524992241560

## Edge Functions
- `create-tenant`: master cria barbearia → cria auth user com senha temporária + role admin + settings + envia e-mail Resend
- `create-subscription`: cria preapproval dinâmico Mercado Pago R$ 39/mês, retorna init_point, salva subscription_id no tenant
