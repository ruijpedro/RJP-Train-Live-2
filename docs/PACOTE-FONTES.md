# Pacote de fontes independentes — RJP Train Live 2.0

**Objetivo:** testar fontes independentes para uma futura migração da **Trains original**, mantendo intactas a aplicação, os alertas, o OTA e as funcionalidades que já existem.

## O que o pacote contém

- \`public/data/cp/manifest.json\` e \`AAAA-MM-DD.json\`: horários programados oficiais CP (GTFS, 7 dias).
- \`public/data/unified/latest.json\`: instantâneo **com prazo de validade** de coordenadas ferroviárias publicadas pela TML, chegadas estimadas e alertas de serviço, cruzados com o GTFS quando existe correspondência verificável.
- \`public/data/unified/diagnostics.json\`: números de veículos por operador, quantos são válidos e quantos conseguimos identificar por número de comboio.
- \`public/data/unified/RELATORIO.md\`: relatório simples da recolha.
- \`src/unified-feed.js\`: motor de normalização para integrar numa API própria.
- \`scripts/build-unified.mjs\`: exportador autónomo do pacote.
- \`tests/unified-feed.test.mjs\`: ensaios para impedir posições inventadas e associações indevidas.

### Critérios técnicos

1. Latitude/longitude de **posições publicadas pela TML**, com carimbo temporal e no máximo 180 segundos de idade; nunca interpolar coordenadas entre estações.
2. \`vehicle_id\` designa o veículo e **não** necessariamente o número de comboio. A associação à circulação CP só é aceite quando há correspondência de \`trip_id\` ou número de serviço inequívoco no GTFS da data.
3. \`eta_at\` é uma **estimativa**, não uma passagem ou atraso comprovado; alerta é um aviso, não uma supressão automaticamente confirmada.
4. O ficheiro \`latest.json\` é **fotografia de um instante**, inválida depois de \`expiresAt\`. Para a app de produção é necessária uma API online que atualize e valide as fontes a cada pedido.
5. A TML pode publicar posições CP de cobertura parcial. Esta experiência **não** prova GPS de todos os R/IR/IC/AP/U ou cobertura nacional.

## Executar

\`\`\`bash
python3 scripts/import_gtfs.py --days 7
node scripts/build-unified.mjs
npm test
\`\`\`

O workflow GitHub Actions da beta cria o artefacto ZIP **RJP-Train-Live-2-Fontes-Unificadas**, com código, dados e relatório, além da APK de testes. Não modifica a Trains original.

## Fontes e licenças

- [GTFS CP](https://publico.cp.pt/gtfs/gtfs.zip), horários programados.
- [GO Hub TML — veículos](https://go.tmlmobilidade.pt/reference/hub/v1/vehicles), posições publicadas.
- [GO Hub TML — ETA](https://go.tmlmobilidade.pt/reference/hub/v1/eta), estimativas.
- [GO Hub TML — alertas](https://go.tmlmobilidade.pt/reference/hub/v1/alerts), avisos.
- [IP — Estações](https://servicos.infraestruturasdeportugal.pt/pt-pt/estacoes), consulta humana de partidas e chegadas; **sem API verificada no pacote**.

Os dados do GO Hub seguem, salvo exceção, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Manter atribuição à TML e CP nas interfaces e nos relatórios.

## Critério de migração para a Trains original

Só após demonstrar correspondência de números CP, frescura e cobertura suficientes para os serviços pretendidos, além de tolerância a falhas, sem perda das funcionalidades e utilizadores existentes. Em caso de fonte indisponível, apresentar indisponibilidade e **nunca** inventar posições.

## API própria experimental — Cloudflare Worker LAB

O pacote inclui \`worker/worker.js\` e \`wrangler.toml\`, completamente separados da Trains original. Ainda **não está publicado**: requer configuração e deploy num Worker novo.

Endpoints previstos:
- \`/health\` — estado e se os horários CP foram configurados.
- \`/api/trains/unified\` — posições TML, ETA ferroviário, alertas e GTFS quando disponível, com origem e validade.
- \`/api/trains/active\` — adaptador de posições reportadas, preparado para teste com a Trains original (sem alterar a app).
- \`/api/trains/diagnostics\` — cobertura, falhas e associações CP.

Para cruzar as posições com o GTFS oficial em tempo real, é preciso publicar os JSON diários que o workflow gera numa origem HTTPS estável e configurar \`CP_SCHEDULE_BASE_URL\` nesse Worker. **Sem esta variável, as coordenadas aparecem mas a associação do número de comboio pode estar indisponível.** O ZIP de dados é um instantâneo e não pode ser utilizado como localização em tempo real depois de \`expiresAt\`.

Este Worker não consulta o Comboios Live/Rui Costa, não modifica a Trains original e não está aprovado para fins operacionais de segurança ferroviária.

## Diagnóstico de cobertura nacional CP / IP

A TML publica sobretudo comboios CP da região de Lisboa. A sonda \`scripts/probe-national.mjs\` testa, com baixa frequência, uma interface pública de informação operacional da IP para R 26450 (Linha do Oeste) e IC 530, e verifica a disponibilidade da configuração pública do site da CP sem revelar quaisquer chaves. Campos de paragens, atrasos, supressões e passagem **não comprovam GPS**. As respostas não são convertidas em coordenadas no mapa.

## Consulta operacional nacional da CP na APK (2.0.4-beta.1)

Através do botão «Consultar CP diretamente», o laboratório consulta um comboio de cada vez e apresenta o estado de circulação, atraso, última estação indicada e horários por paragem conforme o retorno da CP. A ligação usa a configuração publicada por www.cp.pt exclusivamente em memória, apenas para investigação; esta interface não é uma API oficialmente aberta para reutilização sem condições. Não se recolhem nem geram coordenadas GPS do estado operacional. Uma resposta de erro 500/401/403 é apresentada como indisponibilidade, sem aproximação da localização. Antes de aplicar à Trains original, confirmar autorização/termos e continuidade do serviço.

## Catálogo nacional completo (2.0.5-beta.1)

A APK permite encontrar as 1.341 circulações programadas da CP que o GTFS registou no exemplo de 13/11/2026, sem o limite de 100 resultados. Número, linha, origem, destino e paragens são pesquisáveis; a lista cresce em blocos de 80 para desempenho móvel. É possível consultar a API da CP para um comboio selecionado, sem varrer automaticamente todos os serviços. A TML continua a ser a única fonte ativa de coordenadas reais na app; a ausência de GPS permanece explícita. O total varia por data e atualizações do GTFS.

## Comparação das três classes de informação (2.0.6-beta.1)

Na APK, o painel de auditoria apresenta GTFS programado, TML com coordenadas atuais e respostas da API oficial de informação ao passageiro da CP obtidas **por consultas explícitas nesta sessão**. Diferencia respostas simples de horários das respostas que incluam atraso, ETA/ETD, última estação, estado, avisos ou perturbações. Um indicador operacional não equivale a uma passagem confirmada nem a uma localização GPS. A tabela discrimina U, R, IR, IC, AP, SUD e CP. Sem sonda nacional autorizada, a contagem de respostas CP não representa o número total de comboios com dados nacionais disponíveis.
