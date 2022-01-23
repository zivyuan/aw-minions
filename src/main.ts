import fs from 'fs'
import yargs from "yargs"
import { hideBin } from 'yargs/helpers'
import puppeteer from "puppeteer"
import { BrowserLaunchArgumentOptions, ConnectOptions, LaunchOptions, Browser, Page } from "puppeteer"
import { sleep } from 'sleep'
import { Login } from './tasks/'
import { TaskState } from './Task'
import Logger from './Logger'
import Mining from './tasks/mining/Mining'
import config from './config'
import { random } from './utils/utils'
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
  const logger = new Logger('main')
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
      ...config.browserOption
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
    // Browser will be closed after last page was closed
    // Keep at least one page
    for (let i = 1; i < total; i++) {
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
    mainPage.once("domcontentloaded", async () => {
      sleep(1);

      // dingding.markdown(`${MINER_NAME} 启动成功`, `${MINER_NAME} 启动成功`)

      // Start main loop after game page loadeds
      logger.log('miner on duty')
      // const defTask = taskManager.defaultTask
      // taskManager.start(defTask, browser, mainPage)
      const login = new Login({
        username: argv.username[0],
        password: argv.password[0],
      })
      login.start(browser, mainPage, 12)
        .then((task: TaskState) => {
          logger.log('Login task complete', TaskState[task], login.message)
          automine()
        })
        .catch(async (err) => {
          // const CLS_AVATAR = '.css-1i7t220 .chakra-avatar'
          // const avatar = await mainPage.$$(CLS_AVATAR)
          // if (avatar.length === 0) {
          //   //
            logger.log('Login error: ', err)
          // } else {
          //   // Auto login complete. run other task
          //   const mining = new Mining()
          //   mining.start(browser, mainPage)
          // }
        })
    });
  };

  const automine = () => {
    logger.log('Start mining...')
    const mining = new Mining()
    mining.start(browser, mainPage)
      .catch(err => {
        logger.log(err + ', prepare next mining...')
        // setTimeout(automine, 1.5 * 60 * 1000)
      })
      .finally(() => {
        logger.log('Mine complete, prepare next mining...')
        setTimeout(automine, (random(7) + 3) * 60 * 1000)
      })
  }

  await loadGame();
})();


