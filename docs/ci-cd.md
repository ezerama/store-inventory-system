# CI/CD pipeline design

The Jenkins pipeline lives at the root of the repository and follows a process designed to fail fast.

## Stages

1. Checkout
2. Validate configuration
3. Install dependencies
4. Run automated tests
5. Build Docker images
6. Deploy selected version
7. Wait for healthy services
8. Run smoke tests
9. Publish deployment information

## Why the test gate matters

The pipeline stops before deployment when the test stage fails. This ensures that broken code never reaches the running environment.

## Versioning

The `TAG` environment variable is assigned the Jenkins `BUILD_NUMBER` value. This ensures that each deployment is traceable and that rollback can reference a prior docker image tag.

## Triggering

The pipeline can be triggered with either GitHub webhooks or Jenkins Poll SCM. The project documentation describes both setup options.
