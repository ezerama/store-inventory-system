# Testing strategy

## Automated tests

The project includes Jest and Supertest tests for both backend services.

- Inventory API tests check health, retrieval, validation, duplicate SKU detection, and update logic.
- Orders API tests validate order creation, rejection of invalid stock, and stock preservation on failed transactions.

## Test execution

```bash
npm test --prefix inventory-api -- --runInBand
npm test --prefix orders-api -- --runInBand
```

## Quality gate behavior

The Jenkins pipeline runs the tests before Docker image deployment. If any required test fails, the pipeline exits early and the deploy stage does not run.
