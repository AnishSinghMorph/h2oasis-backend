# Testing Guide for H2Oasis Backend

This guide covers how to run tests for the H2Oasis backend API.

## Prerequisites

- Node.js 20.x or higher
- npm or yarn package manager

## Installation

Install testing dependencies:

```bash
npm install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (for development)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

### Run tests in CI mode (for GitHub Actions)
```bash
npm run test:ci
```

## Test Structure

```
__tests__/
├── setup.ts                    # Global test configuration
├── unit/                       # Unit tests (isolated functions)
│   ├── user.model.test.ts
│   └── rook.service.test.ts
└── integration/                # Integration tests (API endpoints)
    ├── health.test.ts
    └── auth.test.ts
```

## Writing Tests

### Unit Test Example

```typescript
describe('MyFunction', () => {
  it('should return expected value', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Integration Test Example (API Endpoint)

```typescript
import request from 'supertest';
import app from '../server';

describe('GET /api/endpoint', () => {
  it('should return 200', async () => {
    const response = await request(app).get('/api/endpoint');
    expect(response.status).toBe(200);
  });
});
```

## Test Coverage

View coverage report after running `npm run test:coverage`:
- Open `coverage/lcov-report/index.html` in your browser

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Push to main branch
- Manual workflow dispatch

## Best Practices

1. **Write tests first** (TDD approach when possible)
2. **Keep tests isolated** - Each test should be independent
3. **Use descriptive names** - Test names should explain what they test
4. **Mock external dependencies** - Don't make real API calls in tests
5. **Test edge cases** - Include error scenarios and boundary conditions
6. **Maintain coverage** - Aim for >80% code coverage

## Troubleshooting

### Tests timeout
Increase timeout in `jest.config.js` or individual tests:
```typescript
jest.setTimeout(15000); // 15 seconds
```

### Module not found errors
Ensure all dependencies are installed:
```bash
npm install
```

### Environment variables
Tests use `.env.test` or mock values from `__tests__/setup.ts`
