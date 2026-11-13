# RJP Train Live 2.0 — CP independente

Aplicação experimental instalada em paralelo com a **RJP Train Live** original. Este repositório foi separado da branch de desenvolvimento `rjp-train-live-2.0` do projeto original, sem modificar o código, alertas, OTA nem APK da versão em produção.

## Dados

Fonte base: [GTFS oficial CP](https://publico.cp.pt/gtfs/gtfs.zip). O importador recolhe horários, serviços, estações e paragens e cria dados para os próximos 7 dias. **O GTFS é estático:** não fornece posições GPS reais, atrasos, confirmações de circulação ou supressões.

A pesquisa funciona por número de comboio e estação; existem filtros U, R, IR, IC, AP e SUD. O mapa usa OpenRailwayMap; as linhas entre estações são esquemáticas, não localizações reais de comboios.

Para diagnosticar o Regional R 26450, o workflow executa `python3 scripts/check_train.py --number 26450`, indicando se consta do GTFS de cada dia. A presença no GTFS não confirma circulação efetiva.

## Compilar no GitHub

O workflow **RJP Train Live 2.0 - CP GTFS** corre a cada alteração e pode ser executado manualmente em Actions → Run workflow.

1. Faz download do GTFS da CP e valida a importação.
2. Compila a WebApp para `dist/`.
3. Compila uma APK autónoma com identificador `pt.rjp.trainlive2`.

**Assinatura Android:** por omissão, se não estiverem configurados segredos de assinatura, o workflow gera uma APK de debug, apenas para ensaio. APKs debug podem não atualizar por cima das anteriores, pois a chave pode variar entre execuções. Para produzir APK de release assinada e atualizável, configura neste repositório os mesmos segredos de assinatura usados na versão experimental:

- `RJP_KEYSTORE_B64`
- `RJP_KEYSTORE_PASSWORD`
- `RJP_KEY_PASSWORD`
- `RJP_KEY_ALIAS`

Não colocamos certificados nem credenciais no código. Uma APK com o identificador `pt.rjp.trainlive2` não substitui a app original; não partilha automaticamente alertas ou dados locais.

## Limitações da beta

- Dados de horários são incluídos na compilação e **ficam desatualizados ao longo do tempo**: é necessário recompilar periodicamente até haver atualização remota autónoma.
- Nenhuma posição GPS nem atraso real é inventado.
- Alertas, notificações, OTA e integração direta em tempo real com CP/IP ainda são fases futuras.

## Desenvolvimento

```bash
python3 scripts/import_gtfs.py --days 7
python3 scripts/check_train.py --number 26450
npm install
npm run build
```

## Posições GPS TML (beta 2.0.1)

O mapa só apresenta marcadores de comboios quando a TML publica latitude, longitude e carimbo temporal de até 3 minutos. São aceites apenas os operadores CP (`N18KL`) e Fertagus (`7NTB1`). Os horários estáticos da CP nunca originam marcadores. Se a TML não divulgar coordenadas da CP, o mapa apresenta zero comboios CP, sem fabricar posições. O acesso direto TML depende de permissões CORS; existe um recurso ao proxy TML da versão anterior apenas para Fertagus, sem consulta ao Rui Costa. A integração independente de toda a CP ainda depende de acesso a uma fonte de posições comprovadas.

## Android GPS — transporte nativo

A APK usa `CapacitorHttp.get` nativo (sem restrições CORS da WebView) para obter posições publicadas pela TML. O navegador mantém pedidos `fetch` e poderá precisar de proxy próprio. O estado da app informa contagens CP/Fertagus e erros de rede; **Ver todos os GPS** centra os marcadores e limpa os filtros. Esta versão não cria localizações interpoladas a partir dos horários GTFS. Coordenadas publicadas não provam automaticamente o tipo de sensor usado pelo operador.


## Pacote unificado de fontes (2.0.2-beta.1)

Ver [docs/PACOTE-FONTES.md](docs/PACOTE-FONTES.md). O GitHub Actions agora disponibiliza o ZIP **RJP-Train-Live-2-Fontes-Unificadas**, com GTFS CP, posições publicadas pela TML, ETA, alertas e diagnósticos, sem alterar a Trains em produção.

## 2.0.3-beta.1 — aplicação do laboratório unificado

A APK passa a executar o motor `buildUnifiedFeed` em cada recolha TML, cruzando as posições reais com o GTFS da CP importado na compilação. Apresenta CP identificados, CP por identificar, Fertagus e número de circulações programadas. O diagnóstico ETA/alertas incluído na compilação é marcado como **histórico** e nunca usado como posição ao vivo. Não foi alterada a Trains original. A API Cloudflare experimental está incluída no repositório mas ainda não foi publicada.

## 2.0.4-beta.1 — consulta CP nacional (LAB)

Adiciona à APK uma consulta manual por número de comboio e data aos dados operacionais da CP: estado, atraso indicado, última estação, paragens, ETA e ETD, quando fornecidos. O acesso é efetuado por pedido explícito, com transporte HTTP nativo no Android e configuração pública do próprio website CP mantida apenas em memória. Não exporta nem regista credenciais. **Esta informação não cria posições GPS** e poderá falhar em caso de restrições ou alterações da CP. A Trains original continua inalterada. A utilização permanente/republicação requer validação das condições de acesso da CP.

## 2.0.5-beta.1 — descobrir todos os comboios da CP no catálogo nacional

O catálogo da aplicação deixa de limitar a apresentação às primeiras 100 circulações: os serviços são apresentados progressivamente em páginas de 80, sem perder a pesquisa por número, percurso, origem, destino ou estação. «Ver todos os CP (GTFS)» abre a lista nacional; cada serviço com número válido tem o botão «Consultar CP» que solicita o estado operacional diretamente à CP, por iniciativa do utilizador. Não são enviados pedidos automáticos para centenas de comboios: evita sobrecarga e bloqueios da fonte. Quando o mesmo número tem posição TML atual, o catálogo indica «GPS TML recebido». Os restantes são apenas horários programados e **não ficam automaticamente localizados**. Os testes impedem limites silenciosos e confundirem GTFS com GPS.
