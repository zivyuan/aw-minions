import DingDingBot from 'dingtalk-robot-sender'

const dingding = new DingDingBot({
  baseUrl: "https://oapi.dingtalk.com/robot/send",
  accessToken: "5c4deeb3badbf565b8905353d4c35dc84f19b182633a75b520dd974675097c83",
  // secret: "SEC076f796b1dd0284ef26061f48845020301276b53f0debc111230469b7b6a510c",
  // 默认的client在纯node环境下不能用
  httpclient: require("urllib"),
});

export default dingding
