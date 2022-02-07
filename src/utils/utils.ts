export const random = (max: number, min = 0): number => {
  return min + Math.floor(Math.random() * (max - min))
}
