# RJP Train Live 2.0

Aplicação experimental independente, baseada nos horários GTFS publicados pela CP.

**Projeto de desenvolvimento:** não substitui a RJP Train Live em produção.

- Android: `pt.rjp.trainlive2` — instalável em paralelo.
- Fonte: GTFS CP (`https://publico.cp.pt/gtfs/gtfs.zip`).
- Dados GTFS são horários programados: não constituem GPS, circulação efetiva nem atrasos em tempo real.
- Alertas e OTA da RJP Train Live original não são usados nesta versão.

## Compilação

GitHub Actions → **RJP Train Live 2.0 - CP GTFS** → *Run workflow*. O workflow importa GTFS, constrói a WebApp e compila a APK de ensaio. APK de release assinada requer configurar os segredos de assinatura Android neste repositório.

## Próximos objetivos

1. Validar cobertura dos horários CP (incluindo R 26450).
2. Cruzar com dados operacionais CP/IP sem inventar posições GPS.
3. Evoluir filtros, mapa, alertas e OTA próprios.
