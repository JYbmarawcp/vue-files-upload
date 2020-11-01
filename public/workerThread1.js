// workerThread1.js

let i = 1

function simpleCount() {
  i++
  self.postMessage(i)
}

simpleCount()
// worker线程接收消息
self.onmessage = ev => {
  // worker线程往主线程发消息
  postMessage(ev.data + ' 呵呵~')
}


// 实战场景

// 1.加密数据 
// 有些加解密的算法比较复杂，或者在加解密很多数据的时候，
// 这会非常耗费计算资源，导致UI线程无响应，
// 因此这是使用Web Worker的好时机，使用Worker线程可以让用户更加无缝的操作UI。

