# Requirements traceability matrix

| Requirement | Implementation | Test / Validation | Documentation |
| --- | --- | --- | --- |
| Multi-module architecture | Frontend, Inventory API, Orders API, DB, proxy | Docker Compose + health checks | README, architecture.md |
| Docker Compose orchestration | docker-compose.yml | docker compose config, compose up | README, architecture.md |
| PostgreSQL persistence | Named volume + init.sql | Docker restart checks | README |
| Jenkins pipeline | Jenkinsfile | Pipeline stages | ci-cd.md |
| Automated tests | inventory-api/tests, orders-api/tests | npm test | testing-strategy.md |
| Health checks | /health routes + compose healthchecks | curl and healthcheck validation | api-reference.md |
| Rollback path | versioned Docker images | docker compose redeploy | deployment-rollback.md |
| Security config | .env.example and credentials guidance | Jenkins credential concept | README |
