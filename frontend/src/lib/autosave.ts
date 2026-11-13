/**
 * Debounced, serialized autosave.
 *
 * Guarantees:
 * - Debounce: a save starts `delay` ms after the last change.
 * - No redundant requests: values are compared (by serialized key) with the last saved value.
 * - Ordering: at most one save is in flight. Changes made during a save are sent after it
 *   completes, so an older request can never land after (and overwrite) a newer one. Responses are
 *   never written back into the editor, so a slow response cannot clobber newer local edits.
 * - Failures: status becomes "error"; the save is retried after `retryDelay` ms, on the next
 *   change, or when `flush()` is called.
 */
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

export interface AutosaverOptions<T> {
  initial: T
  save: (value: T, options: { keepalive: boolean }) => Promise<unknown>
  onStatusChange?: (status: SaveStatus, error?: Error) => void
  delay?: number
  retryDelay?: number
  serialize?: (value: T) => string
  /** Return false for permanent failures (e.g. 403 after access was revoked) to stop auto-retry. */
  shouldRetry?: (error: Error) => boolean
}

export class Autosaver<T> {
  private latest: T
  private latestKey: string
  private savedKey: string
  private status: SaveStatus = 'saved'
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<void> | null = null
  private disposed = false

  private readonly save: AutosaverOptions<T>['save']
  private readonly onStatusChange: AutosaverOptions<T>['onStatusChange']
  private readonly delay: number
  private readonly retryDelay: number
  private readonly serialize: (value: T) => string
  private readonly shouldRetry: (error: Error) => boolean

  constructor(options: AutosaverOptions<T>) {
    this.shouldRetry = options.shouldRetry ?? (() => true)
    this.save = options.save
    this.onStatusChange = options.onStatusChange
    this.delay = options.delay ?? 800
    this.retryDelay = options.retryDelay ?? 5000
    this.serialize = options.serialize ?? ((v) => JSON.stringify(v))
    this.latest = options.initial
    this.latestKey = this.savedKey = this.serialize(options.initial)
  }

  get currentStatus(): SaveStatus {
    return this.status
  }

  get hasUnsavedChanges(): boolean {
    return this.latestKey !== this.savedKey || this.inFlight !== null
  }

  /**
   * Treat `value` as already saved, e.g. the editor's normalized JSON right after loading
   * (Tiptap fills in default attributes, so it can differ textually from the stored JSON).
   */
  resetBaseline(value: T): void {
    if (this.hasUnsavedChanges) return
    this.latest = value
    this.latestKey = this.savedKey = this.serialize(value)
  }

  /** Record a new value and (re)start the debounce timer. */
  update(value: T): void {
    if (this.disposed) return
    this.latest = value
    this.latestKey = this.serialize(value)
    this.clearTimer()

    if (this.latestKey === this.savedKey) {
      // Back to the saved state (e.g. undo): nothing to send.
      if (!this.inFlight) this.setStatus('saved')
      return
    }
    if (!this.inFlight) this.setStatus('pending')
    this.timer = setTimeout(() => void this.flush(), this.delay)
  }

  /** Save now (skipping the debounce). Resolves once everything known so far is saved or failed. */
  flush(): Promise<void> {
    this.clearTimer()
    if (this.inFlight) return this.inFlight.then(() => this.flush())
    if (this.latestKey === this.savedKey) {
      if (this.status !== 'saved') this.setStatus('saved')
      return Promise.resolve()
    }
    return this.run(false)
  }

  /**
   * Best-effort save while the page is being hidden or unloaded. Uses `keepalive` so the request
   * survives navigation; it cannot wait for an in-flight save, so it is only used at unload time.
   */
  flushOnUnload(): void {
    this.clearTimer()
    if (this.latestKey === this.savedKey || this.disposed) return
    void this.run(true)
  }

  /** Stop timers and send any pending change (in order, after an in-flight save). */
  dispose(): void {
    if (this.disposed) return
    const pending = this.latestKey !== this.savedKey
    if (pending) void this.flush()
    this.disposed = true
    this.clearTimer()
  }

  private run(keepalive: boolean): Promise<void> {
    const value = this.latest
    const key = this.latestKey
    this.setStatus('saving')

    const request = this.save(value, { keepalive }).then(
      () => {
        this.savedKey = key
        this.inFlight = null
        if (this.latestKey !== this.savedKey) {
          // Edits arrived while saving. Send them now unless a debounce timer will.
          if (!this.timer && !this.disposed) return this.run(false)
          this.setStatus('pending')
        } else {
          this.setStatus('saved')
        }
      },
      (error: unknown) => {
        this.inFlight = null
        const err = error instanceof Error ? error : new Error(String(error))
        this.setStatus('error', err)
        if (!this.disposed && this.shouldRetry(err)) {
          this.timer = setTimeout(() => void this.flush(), this.retryDelay)
        }
      },
    )
    this.inFlight = request
    return request
  }

  private setStatus(status: SaveStatus, error?: Error) {
    this.status = status
    if (!this.disposed) this.onStatusChange?.(status, error)
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
