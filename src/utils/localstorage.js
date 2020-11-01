function saveObjArr(name, data) {
  // localStorage 存储数组对象的方法
  localStorage.setItem(name, JSON.stringify(data))
}

function getObjArr(name) {
  // localStorage 获取数组对象的方法
  const res = window.localStorage.getItem(name)
  if (res && res !== 'undefined') {
    return JSON.parse(res)
  }
  return false
}

// 存储已上传完成的切片下标
export function addChunkStorage(name, index) {
  const data = [index]
  console.log('addChunkStorage -> name, data', name, data)
  const arr = getObjArr(name)
  if (arr) {
    saveObjArr(name, [...arr, ...data])
  } else {
    saveObjArr(name, data)
  }
}

// 获取已上传完成的切片下标
export function getChunkStorage(name) {
  return getObjArr(name)
}

export function clearLocalStorage(name) {
  localStorage.removeItem(name)
}