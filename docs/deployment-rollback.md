# Deployment and rollback procedure

## Deployment

Use the following command to start the stack:

```bash
docker compose up -d --build
```

The application will be available through the reverse proxy at `http://localhost:8080`.

## Rollback procedure

1. Identify the previous version tag.
2. Redeploy the earlier tag using Docker Compose.
3. Validate that the page loads and health endpoints respond successfully.

Example:

```bash
TAG=1 docker compose up -d --no-build
```

## Notes

- Named volumes keep PostgreSQL data across restarts and normal redeploys.
- Incompatible schema changes may require a manual database migration or reset plan.
- Do not run `docker compose down -v` unless you intentionally want to delete persistent data.
