import { Page } from "puppeteer"
import { sleep } from "sleep"

const selectAll = (ipt) => ipt.select()

export default {
  initial: async (page: Page) => {
    const title = await page.title()
    console.log(title)

    // Wait...
    sleep(2)
    // Close intro modal
    const mbtn = await page.$('.modal-dialog .modal-header button')
    if (mbtn) {
      await page.click('.modal-dialog .modal-header button')
      sleep(1)
    }

    // Select default mode
    await page.click('nav li:nth-child(2) a')
    sleep(1)
    await page.click('main .settings-group button.dropdown-toggle')
    sleep(2)
    await page.click('main .settings-group button.dropdown-toggle+ul.dropdown-menu li:nth-child(2)')
    sleep(1)
    // Save
    await page.click('nav li .btn-success')
    sleep(2)

    // Config proxy setting
    await page.click('nav li[data-profile-type="FixedProfile"] a')
    sleep(2)
    // Select protocol
    await page.select('.fixed-servers tr.ng-scope:nth-child(1) select', 'string:socks5')

    // Input address
    const iptAddr = '.fixed-servers tr.ng-scope:nth-child(1) input:not(.ng-valid-min)'
    await page.$eval(iptAddr, selectAll)
    await page.type(iptAddr, '127.0.0.1')

    // Input port
    const iptPort = '.fixed-servers tr.ng-scope:nth-child(1) input.ng-valid-min'
    await page.$eval(iptPort, selectAll)
    await page.type(iptPort, '9999')

    sleep(1)
    // Save proxy
    await page.click('nav li .btn-success')

    //
    sleep(2)
    await page.click('nav li[data-profile-type="SwitchProfile"] a')
    sleep(2)
    // Skip tutorial
    const selTutorial = '.shepherd-button-secondary'
    const btnTutorial = await page.$(selTutorial)
    if (btnTutorial) {
      await page.click(selTutorial)
    }

    sleep(2)
    const addRule = async (rule: string) => {
      await page.click('.switch-rules tr button[ng-click="addRule()"]')
      sleep(1)
      await page.$eval('.switch-rules tr.switch-rule-row:last-child input', selectAll)
      await page.type('.switch-rules tr.switch-rule-row:last-child input', rule)
      sleep(1)
    }
    const rules = [
      '*.wax.io',
      '*.gstatic.com',
      '*.googleapis.com',
      '*.cloudflareinsights.com',
      "*.googletagmanager.com"
    ]
    let rule
    while((rule = rules.shift())) {
      await addRule(rule)
    }
    sleep(1)
    // Save proxy
    await page.click('nav li .btn-success')
    sleep(1)

    await page.evaluate(() => alert(`Please select proxy mode to [auto switch] in the next 30 seconds.`))
    sleep(35)

    // All set
    await page.close()
    sleep(2)
  }
}
