import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../../../components/ErrorBoundary';

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error during error boundary tests
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render fallback when there is an error', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });

  it('should render default error UI when no fallback is provided', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // The component renders "Something went wrong" (lowercase 'w')
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/encountered an unexpected error/)).toBeInTheDocument();
  });

  it('should show Try Again button that reloads the page', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);

    expect(reloadMock).toHaveBeenCalled();
  });

  it('should show Clear Data & Reload button and call reload on click', () => {
    const reloadMock = vi.fn();
    
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // The actual button text is "Clear Data & Reload"
    const clearButton = screen.getByText('Clear Data & Reload');
    expect(clearButton).toBeInTheDocument();
    
    fireEvent.click(clearButton);
    expect(reloadMock).toHaveBeenCalled();
  });

  it('should log error to console', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });

  it('should display technical details with error message', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // The error message should appear in technical details
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('offers a data-safe reload for an obsolete application chunk', () => {
    const ThrowChunkError = () => {
      throw new TypeError('Failed to fetch dynamically imported module: /assets/ZenAI-old.js');
    };

    render(
      <ErrorBoundary>
        <ThrowChunkError />
      </ErrorBoundary>
    );

    expect(screen.getByText('A newer version is ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload latest version' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear Data & Reload' })).not.toBeInTheDocument();
  });
});
