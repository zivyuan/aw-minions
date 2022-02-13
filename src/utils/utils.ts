export const random = (max: number, min = 0): number => {
  return min + Math.floor(Math.random() * (max - min))
}


export const getAwakeTime = (delay: number, rnd = 90000): number => {
  rnd = rnd < 36000 ? 36000 : rnd
  return (new Date().getTime() + delay + random(rnd, rnd / 3))
}
