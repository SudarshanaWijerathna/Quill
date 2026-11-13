import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Autosaver, type SaveStatus } from './autosave'

/** A save function whose calls can be resolved/rejected manually. */
function controllableSave() {
  const calls: { value: string; resolve: () => void; reject: (e: Error) => void }[] = []
  const save = vi.fn(
    (value: string) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ value, resolve, reject })
      }),
  )
  return { save, calls }
}

function setup(initial = 'v0') {
  const { save, calls } = controllableSave()
  const statuses: SaveStatus[] = []
  const saver = new Autosaver<string>({
    initial,
    save,
    delay: 800,
    retryDelay: 5000,
    onStatusChange: (s) => statuses.push(s),
  })
  return { saver, save, calls, statuses }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Autosaver', () => {
  it('debounces rapid changes into a single save of the latest value', async () => {
    const { saver, save, calls } = setup()
    saver.update('a')
    await vi.advanceTimersByTimeAsync(500)
    saver.update('ab')
    await vi.advanceTimersByTimeAsync(500)
    saver.update('abc')
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
    expect(calls[0]!.value).toBe('abc')
    expect(saver.currentStatus).toBe('saving')

    calls[0]!.resolve()
    await vi.runAllTimersAsync()
    expect(saver.currentStatus).toBe('saved')
    expect(saver.hasUnsavedChanges).toBe(false)
  })

  it('skips requests when the value matches what is already saved', async () => {
    const { saver, save } = setup('v0')
    saver.update('v1')
    saver.update('v0') // e.g. undo back to the saved state
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).not.toHaveBeenCalled()
    expect(saver.currentStatus).toBe('saved')

    await saver.flush()
    expect(save).not.toHaveBeenCalled()
  })

  it('never runs two saves at once and sends edits made during a save afterwards, in order', async () => {
    const { saver, save, calls } = setup()
    saver.update('first')
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)

    // Edit while the first save is still in flight; debounce elapses but must not start a 2nd request.
    saver.update('second')
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
    expect(saver.hasUnsavedChanges).toBe(true)

    calls[0]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(2)
    expect(calls[1]!.value).toBe('second')
    expect(saver.currentStatus).toBe('saving')

    calls[1]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(saver.currentStatus).toBe('saved')
    expect(calls.map((c) => c.value)).toEqual(['first', 'second'])
  })

  it('a slow older save completing does not mark newer edits as saved', async () => {
    const { saver, calls } = setup()
    saver.update('old')
    await vi.advanceTimersByTimeAsync(800)
    saver.update('new') // debounce timer pending
    calls[0]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(saver.currentStatus).toBe('pending')
    expect(saver.hasUnsavedChanges).toBe(true)

    await vi.advanceTimersByTimeAsync(800)
    expect(calls[1]!.value).toBe('new')
  })

  it('reports errors, keeps the change, and retries automatically', async () => {
    const { saver, save, calls, statuses } = setup()
    saver.update('draft')
    await vi.advanceTimersByTimeAsync(800)
    calls[0]!.reject(new Error('Network down'))
    await vi.advanceTimersByTimeAsync(0)
    expect(saver.currentStatus).toBe('error')
    expect(saver.hasUnsavedChanges).toBe(true)
    expect(statuses).toContain('error')

    await vi.advanceTimersByTimeAsync(5000) // retry delay
    expect(save).toHaveBeenCalledTimes(2)
    expect(calls[1]!.value).toBe('draft')
    calls[1]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(saver.currentStatus).toBe('saved')
  })

  it('does not auto-retry permanent failures when shouldRetry returns false', async () => {
    const { save, calls } = controllableSave()
    const saver = new Autosaver<string>({
      initial: 'v0',
      save,
      retryDelay: 5000,
      shouldRetry: (e) => e.message !== 'Forbidden',
    })
    saver.update('edit')
    await vi.advanceTimersByTimeAsync(800)
    calls[0]!.reject(new Error('Forbidden'))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(saver.currentStatus).toBe('error')
  })

  it('retries immediately on flush() after an error', async () => {
    const { saver, save, calls } = setup()
    saver.update('draft')
    await vi.advanceTimersByTimeAsync(800)
    calls[0]!.reject(new Error('500'))
    await vi.advanceTimersByTimeAsync(0)

    const done = saver.flush()
    expect(save).toHaveBeenCalledTimes(2)
    calls[1]!.resolve()
    await done
    expect(saver.currentStatus).toBe('saved')
  })

  it('dispose() sends a pending change instead of dropping it', async () => {
    const { saver, save, calls } = setup()
    saver.update('unsaved')
    saver.dispose() // e.g. navigating away before the debounce fires
    expect(save).toHaveBeenCalledTimes(1)
    expect(calls[0]!.value).toBe('unsaved')

    saver.update('ignored after dispose')
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('dispose() during an in-flight save still sends the newest value afterwards', async () => {
    const { saver, save, calls } = setup()
    saver.update('a')
    await vi.advanceTimersByTimeAsync(800)
    saver.update('b')
    saver.dispose()
    expect(save).toHaveBeenCalledTimes(1)

    calls[0]!.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(2)
    expect(calls[1]!.value).toBe('b')
  })
})
