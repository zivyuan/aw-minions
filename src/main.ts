import fs from 'fs'
import yargs from "yargs"
import { hideBin } from 'yargs/helpers'
import puppeteer from "puppeteer"
import { BrowserLaunchArgumentOptions, ConnectOptions, LaunchOptions, Browser, Page } from "puppeteer"
import { sleep } from 'sleep'
// import TaskManager from "./TaskManager"
// import * as tasks from './tasks/'
import { Login } from './tasks/'
import { TaskState } from './Task'
// import dingding from './Notify'

interface IBotArguments {
  username: string[]
  password: string[]
  platform: string
  endpoint: string
  accounts: string
}
/**
 * Main proccess
 */
(async () => {
  //
  // Initial command line arguments
  //
  const argv = <IBotArguments>yargs(hideBin(process.argv))
    .option("username", {
      alias: "u",
      describe: "Social account to login in Alien Worlds",
      array: true,
    })
    .option("password", {
      alias: "p",
      describe: "The password of the account",
      array: true,
    })
    .option("platform", {
      alias: "P",
      describe: "Social platform",
      choices: ["github"],
      default: "github",
    })
    .option("endpoint", {
      describe: "Develop option for fast load"
    })
    .option("accounts", {
      describe: "Account pool json file",
    })
    .demandOption(["username", "password"])
    .help("help").argv;

  const createBrowser = async () => {
    const option: LaunchOptions & BrowserLaunchArgumentOptions & ConnectOptions = {
      headless: false,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--window-size=800,680",
        "--unhandled-rejections=strict",
      ],
      browserWSEndpoint: ''
    }
    let browser = null;
    if (argv.endpoint) {
      if (/^ws:\/\//.test(argv.endpoint)) {
        option.browserWSEndpoint = argv.endpoint
      } else {
        const ep = fs.readFileSync('.endpoint').toString().trim()
        option.browserWSEndpoint = ep
      }
      // option.devtools = true
      browser = await puppeteer.connect(option);
    } else {
      browser = await puppeteer.launch(option);
    }

    // remove all old tabs
    const pages = await browser.pages();
    const total = pages.length;
    for (let i = 0; i < total; i++) {
      if (!pages[i].isClosed()) {
        await pages[i].close();
      }
    }

    sleep(1)

    return browser;
  };


  let browser: Browser
  let mainPage: Page
  // const taskManager = new TaskManager()
  // taskManager.registerTask(tasks)

  const loadGame = async () => {
    browser = await createBrowser();
    mainPage = await browser.newPage();
    // Open game url
    mainPage.goto("https://play.alienworlds.io/?_nc=" + (new Date().getTime()));

    // start task after all resource loaded
    mainPage.once("load", async () => {
      sleep(1);

      // dingding.markdown(`${MINER_NAME} 启动成功`, `${MINER_NAME} 启动成功`)

      // Start main loop after game page loadeds
      console.log('miner on duty')
      // const defTask = taskManager.defaultTask
      // taskManager.start(defTask, browser, mainPage)
      const login = new Login({
        username: argv.username[0],
        password: argv.password[0],
      })
      login.start(browser, mainPage)
        .then((task: TaskState) => {
          console.log('Login task complete', task)
        })
        .catch(async (err) => {
          console.log('login task error: ', err)
          // await dingding.markdown(`${argv.username[0]} 异常`, `${err}`, {
          //   atMobiles: [],
          //   isAtAll: false
          // })
        })
    });
  };

  await loadGame();
})();


