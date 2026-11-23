# Testing in Kanbrix

This document describes the testing infrastructure for the Kanbrix frontend.

## Test Framework

- **Framework**: Vitest
- **DOM Testing**: @testing-library/react + @testing-library/jest-dom
- **Environment**: jsdom

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode (UI)
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

```
src/
├── components/
│   ├── issues/
│   │   ├── Attachments.test.tsx
│   │   └── ...
│   ├── realtime/
│   └── ui/
├── context/
│   └── useLiveBoard.test.tsx
└── setupTests.ts
```

## Setup File

`src/setupTests.ts` is automatically loaded before tests and includes:
- i18n initialization
- jest-dom extensions for better DOM assertions

## Writing Tests

### Component Tests

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

describe("MyComponent", () => {
  const queryClient = new QueryClient();
  
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("renders correctly", () => {
    render(<MyComponent />, { wrapper });
    expect(screen.getByText(/expected text/i)).toBeTruthy();
  });
});
```

### Mocking API Calls

```tsx
import { apiHooks } from "../../lib/generated-api";

// Mock useQuery
vi.spyOn(apiHooks, "useQuery").mockReturnValue({
  data: mockData,
  isError: false,
  isPending: false,
  isFetching: false,
  refetch: vi.fn(),
} as any);
```

### WebSocket Tests

```tsx
// Mock WebSocket
class FakeWebSocket {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  close = vi.fn();
  constructor(url: string) {
    // capture url for assertions
  }
}

vi.stubGlobal("WebSocket", FakeWebSocket);
```

## API Client Generation

TypeScript types are generated from the OpenAPI schema using:

```bash
# Run the API generation (requires backend running)
npm run generate:api

# Or from local OpenAPI file:
npm run generate:api ./path/to/openapi.json
```

The generated types are in `src/lib/api-schema.d.ts` and used by:
- `src/lib/generated-api.ts` - Type-safe API hooks via openapi-react-query
- `src/components/**/*.tsx` - All API-consuming components