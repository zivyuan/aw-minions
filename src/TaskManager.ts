import { Browser, Page } from "puppeteer";
import { ITask, TaskState } from "./Task";

export default class TaskManager {
  private tasks: ITask[] = []
  private _taskMap = {}
  private _currentTask: ITask
  private _nextTask: string
  private _state = TaskState.Idle
  private _browser: Browser
  private _page: Page
  //
  private tickInterval = 100
  private lastTick = 0
  private _mainLoopStart = false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public onError: (err: any) => void

  constructor() {
    this.tick()
  }

  get state(): TaskState {
    return this._state
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTask(name: string, task: ITask, chain: string): void {
    this._taskMap[name] = task
  }

  setContext(browser: Browser, page: Page): void {
    this._browser = browser
    this._page = page
  }

  start(name: string) {
    if (this._currentTask) {
      this._nextTask = name
    } else {
      const task = this._taskMap[name]
      if (!task) {
        throw new Error('Task [' + name + '] not found!')
      }
      task.start()
    }
  }

  stop(): void {
    this._mainLoopStart = false
    if (this._currentTask) {
      this._currentTask.stop()
    }
  }
}
