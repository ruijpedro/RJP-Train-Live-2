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
