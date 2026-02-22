# Docker Deployment Testing Guide

This document describes the Docker deployment testing infrastructure for CodexDNS.

## Overview

CodexDNS includes comprehensive testing for Docker deployments to ensure:
- Docker images build correctly
- Containers start and run successfully
- Database migrations execute properly in containerized environments
- Web UI and APIs are accessible
- Static assets are served correctly
- Health checks function as expected
- Volume persistence works correctly

## Test Categories

### 1. Docker Build & Launch Tests (`test-docker-launch.sh`)

Basic tests for building and running the Docker image.

**Run:**
```bash
./scripts/test-docker-launch.sh
```

**Features:**
- Builds Docker image from Dockerfile
- Starts container on test port (8888)
- Verifies service startup
- Tests health endpoint
- Checks static assets
- Validates login page
- Tests database migrations
- Checks container health status

**Options:**
```bash
# Skip rebuild (use existing image)
SKIP_BUILD=1 ./scripts/test-docker-launch.sh

# Verbose output
VERBOSE=1 ./scripts/test-docker-launch.sh

# Custom port
TEST_PORT=9999 ./scripts/test-docker-launch.sh
```

### 2. Docker Compose Tests (`test-docker-compose.sh`)

Tests for the docker-compose.yml configuration.

**Run:**
```bash
./scripts/test-docker-compose.sh
```

**Features:**
- Builds and starts complete compose stack
- Tests volume persistence
- Validates port bindings
- Checks environment variables
- Tests healthcheck configuration
- Validates resource limits
- Tests restart policies
- Verifies basic functionality

**Options:**
```bash
# Keep containers running after tests
KEEP_RUNNING=1 ./scripts/test-docker-compose.sh

# Verbose output
VERBOSE=1 ./scripts/test-docker-compose.sh
```

### 3. Playwright Docker Tests (`tests/docker-deployment.spec.ts`)

Comprehensive end-to-end tests using Playwright.

**Run:**
```bash
# Set Docker URL (default: http://localhost:8081)
export DOCKER_TEST_URL=http://localhost:8081
npx playwright test tests/docker-deployment.spec.ts
```

**Test Coverage:**
- Container health check endpoint
- Login page functionality
- Static asset serving (CSS, JS)
- Authentication with default credentials
- Dashboard accessibility
- Database migration validation
- Configuration endpoint access
- DNS settings page
- Statistics pages
- User profile management
- Logout functionality
- Error page handling
- Security headers
- Version endpoint
- Volume persistence
- Migration table verification

### 4. Makefile Targets

Quick access via Make:

```bash
# Run Docker launch tests
make test-docker

# Build Docker image
make docker-build

# Build and push to registries
make docker
```

## GitHub Actions Integration

Automated testing runs on:
- Push to main, develop, or feat/* branches
- Pull requests to main or develop
- Changes to Docker-related files
- Manual workflow dispatch

### Workflows

1. **docker-build-test**: Basic Docker build and functionality
2. **docker-compose-test**: Docker Compose stack validation
3. **playwright-docker-tests**: Full Playwright test suite against Docker
4. **docker-migration-test**: Migration-specific validation

View results: `.github/workflows/docker-tests.yml`

## Test Requirements

### Prerequisites

- Docker or Docker Desktop installed
- Docker Compose V2 (built-in with Docker) or standalone docker-compose
- curl
- bash (for shell scripts)
- Node.js 20+ (for Playwright tests)
- npm (for building CSS)

**Note for WSL users**: The scripts automatically detect and use `docker compose` (V2, built-in) instead of the standalone `docker-compose` command to avoid permission issues with Windows executables.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKER_TEST_URL` | `http://localhost:8081` | URL for Playwright tests |
| `TEST_PORT` | `8888` | Port for test containers |
| `SKIP_BUILD` | `0` | Skip Docker build step |
| `VERBOSE` | `0` | Enable verbose output |
| `KEEP_RUNNING` | `0` | Keep containers after tests |

## Test Scenarios

### Fresh Installation Test

Validates that a fresh Docker deployment:
1. Builds successfully
2. Runs database migrations (version 1)
3. Creates default admin user
4. Serves web UI
5. Responds to health checks

### Volume Persistence Test

Verifies:
- Database volume (`/app/data`)
- Config volume (`/app/config`)
- Logs volume (`/app/logs`)
- Certificate volume (`/app/certs`)

### Migration Validation

Confirms:
- Embedded migrations execute
- Schema version is set to 1
- All 37+ tables are created
- Default admin credentials work

### Resource Limits

Checks:
- Memory limits (512MB max)
- CPU limits (2 CPUs max)
- Minimum reservations (128MB, 0.25 CPU)

### Health Checks

Tests:
- Docker healthcheck configuration
- `/health` endpoint response
- Interval/timeout settings
- Restart on failure

## Troubleshooting

### Container Won't Start

```bash
# View container logs
docker logs codexdns-test-container

# Check last 50 lines
docker logs --tail 50 codexdns-test-container

# Follow logs
docker logs -f codexdns-test-container
```

### Health Check Failing

```bash
# Inspect health status
docker inspect --format='{{.State.Health.Status}}' codexdns

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' codexdns
```

### Migration Issues

```bash
# Check migration logs
docker logs codexdns | grep -i migration

# Connect to database
docker exec -it codexdns sqlite3 /app/data/codexdns.db

# Check schema version
sqlite> SELECT * FROM schema_migrations;
```

### Port Conflicts

```bash
# Use custom port
TEST_PORT=9999 ./scripts/test-docker-launch.sh

# Or update docker-compose.yml port mapping
ports:
  - "9999:8080"  # Change host port
```

### Build Cache Issues

```bash
# Clear Docker build cache
docker builder prune

# Rebuild without cache
docker build --no-cache -t codexdns:test -f tools/docker/Dockerfile .
```

## Best Practices

1. **Run tests before pushing**: Validate Docker changes locally
2. **Check CI results**: Review GitHub Actions after pushing
3. **Test migrations**: Always test migration changes in Docker
4. **Clean up volumes**: Remove test volumes after local testing
5. **Monitor logs**: Watch container logs during development

## Manual Testing

### Quick Test

```bash
# Build and run
cd tools/docker
docker-compose up -d --build

# Access UI
open http://localhost:8081

# Login with: admin / admin123

# Stop
docker-compose down -v
```

### Development Testing

```bash
# Keep running for development
KEEP_RUNNING=1 ./scripts/test-docker-compose.sh

# Make changes, rebuild
docker-compose -f tools/docker/docker-compose.yml build

# Restart service
docker-compose -f tools/docker/docker-compose.yml restart

# Cleanup when done
docker-compose -f tools/docker/docker-compose.yml down -v
```

## Continuous Improvement

Test additions should cover:
- New configuration options
- Additional database drivers
- DNS/DHCP functionality
- Multi-architecture builds
- Security enhancements
- Performance benchmarks

## Related Documentation

- [Dockerfile](../tools/docker/Dockerfile)
- [docker-compose.yml](../tools/docker/docker-compose.yml)
- [Migration Consolidation](./migration-consolidation-v1.md)
- [Production Deployment](./codexdns-os-installation.md)

## Support

For issues or questions:
1. Check container logs
2. Review test output
3. Consult GitHub Actions logs
4. Create issue with logs attached
