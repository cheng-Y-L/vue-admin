/** 格式化为本地时间 YYYY-MM-DD HH:mm:ss（避免 toISOString 的 UTC 偏差） */
export function formatLocalDateTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
