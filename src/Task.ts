import { Page } from "puppeteer"
import { Browser } from "puppeteer"
import config from "./config"
import Logger from "./Logger"

export interface ITask {
  readonly name: string
  readonly state: TaskState
  readonly message: string
  readonly phase: string
  readonly phaseElapseTime: number

  start(browser: Browser, page: Page): Promise<TaskState>

  stop(): void
}

export enum TaskState {
  Idle,
  Running,
  Completed,
  Canceled,
  Interrupted,
  Error
}

type StepHandle = () => void

export interface TaskStep {
  [step: string]: StepHandle
}

const logger = new Logger()
export default class BaseTask implements ITask {
  private _name = 'Task'

  protected _message = ''
  protected _state: TaskState = TaskState.Idle
  protected _phase = 'ready'
  protected _phaseTimeMark = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected _resolve: (value: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected _reject: (reason?: any) => void
  protected browser: Browser
  protected page: Page
  // 子步骤终止
  protected _terminateHandle: () => void
  private _steps: TaskStep = {}
  private _entrance: string

  constructor(name: string) {
    this._name = name
    this._phaseTimeMark = new Date().getTime()

    logger.setScope(name)
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

  protected get entrance(): string {
    return this._entrance
  }

  protected registerStep(name: string, handle: StepHandle, first = false) {
    this._steps[name] = handle
    if (first === true) {
      this._entrance = name
    }
  }

  protected nextStep(name: string) {
    const step = this._steps[name]
    logger.log(`Step ${name}`)
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
      this.error('Task timeout')
    } else {
      setTimeout(() => {
        step.call(this)
      }, config.tickInterval)
    }
  }

  protected updatePhase(phase: string) {
    if (this._phase === phase) {
      return
    }

    logger.log(`update phase: ${phase}`)
    this._phaseTimeMark = new Date().getTime()
    this._phase = phase
  }


  protected error(message) {
    this._state = TaskState.Error
    this._message = message
    this._reject(message)
  }

  protected success(state: TaskState, message?: string) {
    this._state = state
    this._message = message || ''
    this._resolve(this.state)
  }

  start(browser: Browser, page: Page): Promise<TaskState> {
    this.browser = browser
    this.page = page

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

}
