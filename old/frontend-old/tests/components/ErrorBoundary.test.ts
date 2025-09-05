import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

describe('ErrorBoundary', () => {
  let router: any
  let mockConsoleError: any
  let mockWindowAddEventListener: any
  let mockWindowRemoveEventListener: any

  beforeEach(() => {
    // Create router
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } }
      ]
    })

    // Mock console.error to prevent error output in tests
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Mock window event listeners
    mockWindowAddEventListener = vi.spyOn(window, 'addEventListener')
    mockWindowRemoveEventListener = vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    mockConsoleError.mockRestore()
    mockWindowAddEventListener.mockRestore()
    mockWindowRemoveEventListener.mockRestore()
  })

  it('renders slot content when no error', () => {
    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      slots: {
        default: '<div>Normal content</div>'
      }
    })

    expect(wrapper.text()).toContain('Normal content')
    expect(wrapper.find('.error-boundary').exists()).toBe(false)
  })

  it('displays error UI when error is captured', async () => {
    const ThrowingComponent = {
      setup() {
        throw new Error('Test error')
      },
      template: '<div>Should not render</div>'
    }

    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      slots: {
        default: ThrowingComponent
      }
    })

    await flushPromises()

    expect(wrapper.find('.error-boundary').exists()).toBe(true)
    expect(wrapper.text()).toContain('Something went wrong')
    expect(wrapper.text()).toContain('An unexpected error occurred')
  })

  it('shows custom error title and message', async () => {
    const ThrowingComponent = {
      setup() {
        throw new Error('Test error')
      },
      template: '<div>Should not render</div>'
    }

    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      props: {
        errorTitle: 'Custom Error Title',
        errorMessage: 'Custom error message'
      },
      slots: {
        default: ThrowingComponent
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Custom Error Title')
    expect(wrapper.text()).toContain('Custom error message')
  })

  it('shows technical details when showDetails is true', async () => {
    const ThrowingComponent = {
      setup() {
        throw new Error('Detailed error message')
      },
      template: '<div>Should not render</div>'
    }

    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      props: {
        showDetails: true
      },
      slots: {
        default: ThrowingComponent
      }
    })

    await flushPromises()

    expect(wrapper.find('.error-details').exists()).toBe(true)
    expect(wrapper.find('details').exists()).toBe(true)
    expect(wrapper.text()).toContain('Technical Details')
  })

  it('handles retry functionality', async () => {
    const onRetry = vi.fn()
    let shouldThrow = true
    
    const ConditionalComponent = {
      setup() {
        if (shouldThrow) {
          throw new Error('Test error')
        }
      },
      template: '<div>Success content</div>'
    }

    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      props: {
        onRetry
      },
      slots: {
        default: ConditionalComponent
      }
    })

    await flushPromises()

    // Error should be displayed
    expect(wrapper.find('.error-boundary').exists()).toBe(true)
    
    // Click retry button
    shouldThrow = false
    await wrapper.find('.btn-retry').trigger('click')
    
    expect(onRetry).toHaveBeenCalled()
    expect(wrapper.find('.error-boundary').exists()).toBe(false)
  })

  it('handles reset functionality', async () => {
    // Mock window.location.reload
    const mockReload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true
    })

    const ThrowingComponent = {
      setup() {
        throw new Error('Test error')
      },
      template: '<div>Should not render</div>'
    }

    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      slots: {
        default: ThrowingComponent
      }
    })

    await flushPromises()

    // Click reset button
    await wrapper.find('.btn-reset').trigger('click')
    
    expect(mockReload).toHaveBeenCalled()
    expect(wrapper.emitted('reset')).toBeTruthy()
  })

  it('navigates home when go home button is clicked', async () => {
    const ThrowingComponent = {
      setup() {
        throw new Error('Test error')
      },
      template: '<div>Should not render</div>'
    }

    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      slots: {
        default: ThrowingComponent
      }
    })

    await flushPromises()
    await router.push('/some-route')

    // Click go home button
    await wrapper.find('.btn-home').trigger('click')
    
    expect(router.currentRoute.value.path).toBe('/')
    expect(wrapper.find('.error-boundary').exists()).toBe(false)
  })

  it('reports error when report button is clicked', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    })
    global.fetch = mockFetch
    
    // Mock alert
    const mockAlert = vi.fn()
    global.alert = mockAlert

    const ThrowingComponent = {
      setup() {
        throw new Error('Test error')
      },
      template: '<div>Should not render</div>'
    }

    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      props: {
        allowReporting: true
      },
      slots: {
        default: ThrowingComponent
      }
    })

    await flushPromises()

    // Click report button
    await wrapper.find('.btn-report').trigger('click')
    await flushPromises()
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/errors/report',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: expect.stringContaining('Test error')
      })
    )
    
    expect(mockAlert).toHaveBeenCalledWith('Error reported successfully. Thank you!')
  })

  it('handles failed error reporting', async () => {
    // Mock fetch to fail
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    global.fetch = mockFetch
    
    // Mock alert
    const mockAlert = vi.fn()
    global.alert = mockAlert

    const ThrowingComponent = {
      setup() {
        throw new Error('Test error')
      },
      template: '<div>Should not render</div>'
    }

    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      props: {
        allowReporting: true
      },
      slots: {
        default: ThrowingComponent
      }
    })

    await flushPromises()

    // Click report button
    await wrapper.find('.btn-report').trigger('click')
    await flushPromises()
    
    expect(mockAlert).toHaveBeenCalledWith('Failed to report error. Please try again later.')
  })

  it('captures unhandled promise rejections', async () => {
    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      slots: {
        default: '<div>Normal content</div>'
      }
    })

    // Simulate unhandled rejection
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.reject('Test rejection'),
      reason: 'Test rejection'
    })
    
    window.dispatchEvent(event)
    await flushPromises()

    expect(wrapper.find('.error-boundary').exists()).toBe(true)
    expect(wrapper.find('.error-details').text()).toContain('Unhandled Promise Rejection')
  })

  it('captures global errors', async () => {
    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      slots: {
        default: '<div>Normal content</div>'
      }
    })

    // Simulate global error
    const event = new ErrorEvent('error', {
      message: 'Global error message',
      filename: 'test.js',
      lineno: 10,
      colno: 5,
      error: new Error('Global error')
    })
    
    window.dispatchEvent(event)
    await flushPromises()

    expect(wrapper.find('.error-boundary').exists()).toBe(true)
    expect(wrapper.find('.error-details').text()).toContain('Global error message')
  })

  it('prevents error propagation when fallback is true', async () => {
    const ThrowingComponent = {
      setup() {
        throw new Error('Test error')
      },
      template: '<div>Should not render</div>'
    }

    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      props: {
        fallback: true
      },
      slots: {
        default: ThrowingComponent
      }
    })

    await flushPromises()

    // Error should be captured and not propagated
    expect(wrapper.find('.error-boundary').exists()).toBe(true)
    // The console.error should still be called for logging
    expect(mockConsoleError).toHaveBeenCalled()
  })

  it('emits error event when error is captured', async () => {
    const ThrowingComponent = {
      setup() {
        throw new Error('Test error')
      },
      template: '<div>Should not render</div>'
    }

    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      slots: {
        default: ThrowingComponent
      }
    })

    await flushPromises()

    expect(wrapper.emitted('error')).toBeTruthy()
    const errorEvent = wrapper.emitted('error')![0] as any[]
    expect(errorEvent[0]).toBeInstanceOf(Error)
    expect(errorEvent[0].message).toBe('Test error')
  })

  it('removes event listeners on unmount', async () => {
    const wrapper = mount(ErrorBoundary, {
      global: {
        plugins: [router]
      },
      slots: {
        default: '<div>Normal content</div>'
      }
    })

    // Event listeners should be added on mount
    expect(mockWindowAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
    expect(mockWindowAddEventListener).toHaveBeenCalledWith('error', expect.any(Function))

    // Unmount component
    wrapper.unmount()

    // Event listeners should be removed
    expect(mockWindowRemoveEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
    expect(mockWindowRemoveEventListener).toHaveBeenCalledWith('error', expect.any(Function))
  })
})