/* eslint-disable @typescript-eslint/no-explicit-any */
import { Page } from "puppeteer"
import config from "../config"
import Logger from "../Logger"
import { sleep } from 'sleep'
import { Browser } from "puppeteer"
import { IMiningDataProvider } from "../Minion"


export enum TaskState {
  Idle,
  Running,
  Completed,
  Canceled,
  Abort,
  Interrupted,
  Error
}

type StepHandle = () => void

export interface TaskStep {
  [step: string]: StepHandle
}

export interface InspectorHandle {
  (browser: Browser, page: Page): boolean
}

export interface ITaskResult<T> {
  state: TaskState
  // The next awake time of task, make task tempoary sleep
  message: string
  data: T | null
  awakeTime?: number
}

export enum TaskType {
  Single,
  Group
}

export type ITaskNoResult = null

export interface ITask<T> {
  readonly no: number
  readonly name: string
  readonly state: TaskState
  readonly message: string
  readonly phase: string
  readonly phaseElapseTime: number
  readonly type: TaskType

  setProvider(provider: IMiningDataProvider): void

  start(): Promise<ITaskResult<T>>

  prepare(): Promise<void>

  stop(): void

  destroy(): void
}

export type TaskClass = typeof BaseTask & { meta: { [prop: string]: any } }

let __uuid = 0
const logger = new Logger()
export default class BaseTask<T> implements ITask<T> {
  private __no: number
  private _name = 'Task'
  private _type: TaskType = TaskType.Single

  protected _message = ''
  protected _state: TaskState = TaskState.Idle
  protected _phase = 'ready'
  protected _phaseTimeMark = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected _resolve: (value: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected _reject: (reason?: any) => void
  // 子步骤终止
  protected _terminateHandle: () => void
  private _steps: TaskStep = {}
  private _entrance: string
  private _provider: IMiningDataProvider

  constructor(name: string) {
    this._name = name
    this._phaseTimeMark = new Date().getTime()
    this.__no = (__uuid++)

    logger.setScope(name)
  }

  get no(): number {
    return this.__no
  }

  get type(): TaskType {
    return this._type
  }

  get name(): string {
    return this._name
  }

  get state(): TaskState {
    return this._state
  }

  get message(): string {
    return this._message
  }

  get phase(): string {
    return this._phase
  }

  get phaseElapseTime(): number {
    const current = new Date().getTime()
    return current - this._phaseTimeMark
  }

  protected get provider(): IMiningDataProvider {
    return this._provider
  }

  protected get entrance(): string {
    return this._entrance
  }

  protected registerStep(name: string, handle: StepHandle, first = false) {
    this._steps[name] = handle
    if (first === true) {
      this._entrance = name
    }
  }

  protected nextStep(name: string, delay?: number) {
    if (delay) {
      sleep(delay)
    }

    const step = this._steps[name]
    this.updatePhase('step-' + name)
    step.call(this)
  }

  /**
   * Call step funciton after a delay
   * @param name Step name
   */
  protected tick(name: string) {
    const step = this._steps[name]
    const elapse = this.phaseElapseTime

    if (elapse > config.taskPhaseTimeout) {
      this.completeWithError('Task timeout')
    } else {
      setTimeout(() => {
        step.call(this)
      }, config.tickInterval)
    }
  }

  /**
   * Test condition until excepted
   * @param condition Test function
   * @returns Test result
   */
  protected async waitUtil<T>(condition: () => any): Promise<T> {
    return new Promise((resolve) => {
      const loop = async () => {
        try {
          const rst = await condition()
          resolve(rst)
        } catch(err) {
          setTimeout(() => {
            this.waitUtil(condition)
          }, 500)
        }
      }
      loop()
    })
  }

  protected updatePhase(phase: string) {
    if (this._phase === phase) {
      return
    }

    this._phaseTimeMark = new Date().getTime()
    this._phase = phase
  }

  protected completeWithError(message) {
    this._state = TaskState.Error
    this._message = message
    this._reject(message)
  }

  protected complete(state: TaskState, message?: string, data?: T, awake?: number) {
    this._state = state
    this._message = message || ''
    this._resolve({
      state: this._state,
      message: this._message,
      data: data || null,
      awakeTime: awake
    })
  }

  setProvider(provider: IMiningDataProvider): void {
    this._provider = provider
  }

  async prepare(): Promise<void> {}

  start(): Promise<ITaskResult<T>> {
    return new Promise((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject

      this.nextStep(this.entrance)
    })
  }

  stop(): void {
    if (this._terminateHandle) {
      this._terminateHandle()
    }
    this._reject(new Error('User terminated.'))
  }

  destroy(): void {}

  /**
   *
   * @param handle An inspect function, accept a browser and a page as parameter
   * @param interval
   * @returns
   */
  inspect<T>(handle: InspectorHandle, interval: 200): Promise<T> {
    return new Promise((resolve, reject) => {
      const loop = async () => {
        let rst
        try {
          rst = await handle(null, null)
        } catch (err) {
          reject(err)
        }

        if (typeof rst !== 'undefined') {
          resolve(rst)
          return
        }

        setTimeout(() => {
          loop()
        }, interval)
      }

      loop()
    })
  }

}
