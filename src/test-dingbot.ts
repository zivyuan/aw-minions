import config from "./config";
import DingBot from "./DingBot";

const bot = DingBot.getInstance()
bot.initial(config.dingding)


bot.text('this is a test message from dingbot')
  .then(rst => console.log(rst))
  .catch(err => console.log(err))
