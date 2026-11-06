# Preflight consolidado das migrações de segurança do HomeFin

Para a execução simplificada, use `preflight-hardening-consolidado.sql`. O arquivo original `scripts/preflight-hardening-supabase.sql` foi preservado sem alterações.

## Execução consolidada

1. Abra `preflight-hardening-consolidado.sql`.
2. Copie todo o conteúdo do arquivo.
3. Cole uma única vez no SQL Editor do projeto Supabase correto.
4. Execute uma vez e analise o único conjunto de resultados, filtrando pela coluna `situacao`.

A consulta consolidada é uma única instrução somente de leitura, composta por CTEs e `SELECT`. Ela retorna uma linha por verificação com categoria, resultado encontrado, situação (`OK`, `ATENÇÃO` ou `BLOQUEIO`) e descrição. Não retorna valores de PIN, hashes, tokens, senhas, mensagens de suporte, linhas financeiras ou objetos individuais; os inventários de famílias, planilhas e pagamentos mostram apenas IDs e contagens. Consultas dinâmicas são constantes, somente leitura e retornam agregados, não registros individuais.

As verificações dinâmicas só consultam tabelas quando a relação, colunas necessárias e permissão `SELECT` do usuário atual do SQL Editor são reconhecidas. Caso contrário, o resultado informa que não foi possível verificar por ausência/incompatibilidade de estrutura ou de permissão. A consulta também compara os grants efetivos das tabelas: exige `SELECT`, `INSERT`, `UPDATE` e `DELETE` para `service_role`, e bloqueia privilégios efetivos de `PUBLIC`, `anon` ou `authenticated`. A presença de índices é apresentada para conferência da definição; a existência pelo nome não é tratada como prova de compatibilidade. Policies existentes também ficam em `ATENÇÃO` para revisão de escopo e expressão. Quando a consulta ao catálogo ou ao próprio resultado do SQL Editor for bloqueada para a sessão, o PostgreSQL pode encerrar a instrução com erro em vez de produzir uma linha; nesse caso, conceda acesso de leitura somente ao operador autorizado ou execute como o papel administrativo aprovado e repita. Não interprete erro ou ausência de resultados como `OK`.

Para Storage, a verificação exige o bucket privado e a policy restritiva específica de `attachments`, além de conferir RLS e os grants de `service_role`. Grants globais em `storage.objects` são mostrados como aviso, não como motivo para removê-los: eles podem ser necessários para outros buckets. A policy por bucket precisa ser validada sem revogar permissões globais.

As 21 consultas/verificações do arquivo original foram mapeadas para as linhas do resultado consolidado, incluindo tabelas, colunas, índices, RPCs, RLS, grants, policies, famílias e credenciais, recuperação, dados/anexos, planilhas, pagamentos, bucket/objetos e papéis PostgreSQL. As categorias incluem estrutura, famílias, credenciais e recuperação, RPCs, RLS/grants/policies, Storage, planilhas/pagamentos, suporte/Push e pré-requisitos. Contagens de famílias usam IDs distintos. IDs familiares podem aparecer para permitir o provisionamento administrativo; trate o resultado como informação restrita.

As RPCs correspondem ao código e às migrações atuais, incluindo argumentos, tipo de retorno e expectativa de `SECURITY DEFINER`: `homefin_create_family_with_credentials(jsonb,text,text,text,text) -> jsonb`, `homefin_register_auth_failure(text,text) -> boolean` e `homefin_delete_family(text) -> boolean` são chamadas pelo backend. `homefin_activate_paid_plan(text,text,text,numeric,text) -> jsonb` é definida em `migracao-pagamentos-segura.sql`, mas não foi encontrada chamada ativa no código. As sobrecargas antigas de três e um parâmetros são verificadas como legadas/opcionais, não como APIs atuais.

O arquivo abaixo permanece como alternativa detalhada, com consultas separadas:

## Como executar

1. Faça e verifique um backup do banco antes de qualquer migração.
2. Abra o SQL Editor do projeto Supabase correto, com uma conta autorizada a ler o catálogo e os dados administrativos.
3. Abra `scripts/preflight-hardening-supabase.sql` e execute **um SELECT por vez**, na ordem. Não selecione nem execute nenhum outro arquivo de migração durante o preflight.
4. Comece pelas consultas de existência de tabelas/colunas, funções, RLS, grants e policies.
5. Se `homefin_saas`, `homefin_family_credentials` ou `homefin_data` estiver ausente, não execute as consultas seguintes que leem essas tabelas. A ausência é um bloqueio a resolver primeiro.
6. As consultas de planilhas e pagamentos só podem ser executadas quando as respectivas tabelas existirem. A consulta de Storage depende de `storage.buckets` e `storage.objects`, disponibilizadas pelo Supabase.
7. Guarde os resultados de forma protegida. A listagem de famílias mostra apenas IDs administrativos; não compartilhe publicamente esses resultados.

## O que conferir

### Estrutura

- `homefin_saas` e `homefin_data` são pré-requisitos do código atual.
- Para autenticação, compare a estrutura instalada com as colunas de `homefin_family_credentials` e `homefin_auth_attempts`. A versão final requer `recovery_salt`, `recovery_hash`, `session_version` e `ip_hash`.
- Planilhas, pagamentos, suporte, Push e a fila devem apresentar todas as colunas e tipos indicados pela consulta de estrutura depois das migrações que as criam.
- A consulta de índices indica os índices esperados, mas a ausência de um índice não significa perda de dados; confirme antes de prosseguir.
- `CREATE TABLE IF NOT EXISTS` não corrige automaticamente uma tabela preexistente com colunas/tipos incompatíveis. Qualquer `TYPE_MISMATCH` precisa de análise e plano de compatibilidade próprio — não aplique a migração no escuro.

### Famílias e dados

- Compare o total de famílias em `homefin_saas.data.families` com famílias que têm credencial e dados financeiros.
- Revise a lista de IDs sem credencial: são candidatas a provisionamento controlado, não a criação automática.
- Famílias com credencial mas sem hash de recuperação podem entrar com o PIN server-side e cadastrar uma nova palavra-chave de recuperação. Não recupere o valor da palavra-chave nem do PIN local.
- A contagem de anexos consulta `homefin_data.data.bills[].attachments[]` e diferencia referências de Storage por `storagePath` ou URL de Storage. Confirme se a estrutura real dos dados segue esse formato.
- As consultas de planilhas e pagamentos mostram registros por `family_id`; confira que IDs pertençam às famílias esperadas.

### RPCs e permissões

- Para o código atual, as assinaturas finais esperadas são:
  - `homefin_create_family_with_credentials(jsonb, text, text, text, text)` — chamada pelo cadastro atual.
  - `homefin_register_auth_failure(text, text)` — chamada pelo login atual.
  - `homefin_activate_paid_plan(text, text, text, numeric, text)` — definida pela migração de pagamentos; não encontrei chamada ativa a essa RPC nas APIs atuais.
  - `homefin_delete_family(text)` — chamada pela exclusão familiar.
- As sobrecargas antigas de três parâmetros para cadastro e um parâmetro para rate limit podem existir após migrações anteriores. O hardening restringe sua execução a `service_role`; o código atual não deve depender delas.
- Depois do hardening, tabelas privadas não devem conceder privilégios de leitura/escrita a `PUBLIC`, `anon` ou `authenticated`. APIs server-side usam `service_role` e aplicam validação/filtros próprios por família.
- RLS habilitado não basta, isoladamente, para provar isolamento. Confirme também as policies, privilégios e filtros das APIs; a chave de serviço contorna RLS e deve permanecer somente no servidor.

### Storage

- O bucket `attachments` deve existir. A configuração final esperada é `is_public = false`.
- A migração instala uma policy `RESTRICTIVE` para impedir acesso direto de `anon` e `authenticated` a esse bucket, sem revogar privilégios globais de `storage.objects` que possam afetar outros buckets.
- As APIs de anexos usam `service_role`, validam sessão familiar e validam caminhos. A contagem de objetos não revela nomes nem caminhos.
- A fila `homefin_storage_cleanup_queue` é necessária para recuperação de exclusões em que a limpeza do Storage falhe após o banco confirmar a exclusão.

## Bloqueios antes das migrações

- Schema-base, registro `homefin_saas.id = 'global'` ou bucket `attachments` ausente.
- Colunas ou tipos incompatíveis, especialmente em tabelas que `CREATE TABLE IF NOT EXISTS` não atualiza.
- Funções antigas ou novas com privilégios inesperados para `anon`/`authenticated`.
- Políticas/grants que mantenham acesso direto a dados financeiros ou anexos.
- Divergência entre IDs de família no SaaS, dados financeiros e credenciais.
- Dados financeiros pendentes de sincronização local: esses dados não aparecem no Supabase e não podem ser contabilizados pelo preflight.
- Famílias legadas sem credencial server-side: a migração de credenciais precisa ser tratada antes de revogar o acesso antigo.
- Famílias que precisam de recuperação, mas não têm recovery hash: confirmar procedimento de acesso antes de qualquer alteração de sessão.

## Provisionamento de famílias antigas

1. Use a lista de IDs retornada pelo preflight e confirme a titularidade da família por um canal operacional confiável.
2. Confirme que a família existe em `homefin_saas.data.families` e verifique se possui credencial server-side.
3. Após aplicar `migracao-provisionamento-familiar-controlado.sql`, use a sessão administrativa válida para emitir autorização. A API grava uma referência pseudônima derivada do token de sessão; como o login admin ainda usa um segredo compartilhado, essa referência identifica a sessão, não uma pessoa.
4. Declare a confirmação da titularidade por canal independente e selecione o método. A declaração, a referência da sessão e o tipo de operação ficam na auditoria. Não registre documentos ou dados pessoais.
5. Para família sem credencial, emita `provision`; para pessoa que perdeu o PIN de família já credenciada, emita `pin_recovery`. A família define novo PIN pelo código temporário; não copie PINs, hashes ou palavras-chave do navegador.
6. O código é aleatório, expira em 15 minutos, é escopado à família, limitado por tentativas e consumido uma única vez. A redefinição incrementa `session_version` e invalida as sessões antigas sem alterar o hash de recuperação nem dados financeiros.
7. Confirme o resultado consultando apenas IDs, versão de sessão e presença de hash de recuperação; nunca selecione PINs ou hashes.

O login administrativo atual não autentica pessoas individualmente. O identificador de auditoria é pseudônimo por sessão e não deve ser apresentado como prova pessoal de autoria. A confirmação de titularidade continua sendo uma declaração do operador responsável.

## Ordem recomendada

1. Backup verificado e preflight somente leitura.
2. `migracao-autenticacao-familiar.sql`, se a tabela de credenciais/tentativas ainda não existir.
3. `migracao-cadastro-familiar-seguro.sql` somente se necessário para a etapa de cadastro compatível; ela cria a RPC antiga de 3 parâmetros, que deve depois ser substituída pela definição de 5 parâmetros do hardening antes de habilitar o código atual.
4. `migracao-planilhas.sql` e `migracao-pagamentos-segura.sql`, se as respectivas tabelas ainda não existirem.
5. A variante de hardening compatível com Storage e anexos, após validar dependências e revisar os grants. Não execute simultaneamente variantes duplicadas.
6. `migracao-provisionamento-familiar-controlado.sql` por último, depois de confirmar `session_version`, tabelas base, permissões e funções esperadas.

O SQL de provisionamento usa `BEGIN`/`COMMIT`. Se uma instrução falhar, não force a continuação: faça `ROLLBACK` da sessão, corrija a causa e reexecute o arquivo completo após revisar o estado. Se houver evidência de execução de uma versão anterior sem transação, preserve as tabelas e o histórico e faça correções para frente; a migração revisada adiciona as colunas de propósito/declaração, recusa autorizações antigas sem declaração e revoga a execução da assinatura antiga de emissão. Não apague tabelas ou credenciais como forma de rollback.

Não execute migrações repetidamente apenas porque usam `IF NOT EXISTS` ou `CREATE OR REPLACE`: isso não prova compatibilidade de objetos que já existam e substituir RPCs altera comportamento.

## Validação estática e limitações

O SQL consolidado e cada SELECT interno fixo de `query_to_xml` foram analisados por um parser PostgreSQL local. A consulta tem exatamente uma instrução no nível superior. A compatibilidade das saídas de `UNION ALL`, textos/XMLTABLE e os casts foi revisada estaticamente; sem conexão ao PostgreSQL alvo, não é possível resolver em tempo de execução permissões efetivas, tipos/objetos existentes nem validar resultados contra o catálogo real.

Este preflight não executa nenhuma consulta e não acessa o projeto Supabase. Os resultados reais dependem da execução manual no projeto correto. O projeto está preparado para **iniciar a pré-validação**; ainda não há evidência suficiente para afirmar que o banco está pronto para executar migrações. Só prossiga após conferir os resultados, o backup e o provisionamento das famílias sem credencial.

Nenhuma migração foi executada como parte desta etapa.
