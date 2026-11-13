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
