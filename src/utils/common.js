export function formatByte(size) {
  size = Number(size) || 0
  if (!size) {
    return '0B' 
  }
  let num = 1024.0
  if (size < num) {
    return size + 'B'
  }
  if (size < Math.pow(num, 2)) {
    return (size / num).toFixed(2) + 'K'
  }
  if (size < Math.pow(num, 3)) {
    return (size / Math.pow(num, 2)).toFixed(2) + 'M'
  }
  if (size < Math.pow(num, 4)) {
    return (size / Math.pow(num, 3)).toFixed(2) + 'G'
  }
  return (size / Math.pow(num, 3)).toFixed(2) + 'T'
}
