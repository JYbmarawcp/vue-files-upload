self.importScripts("/spark-md5.min.js") // 导入脚本

// 生成文件 hash
self.onmessage = e => {
  const { fileChunkList } = e.data
  const spark = new self.SparkMD5.ArrayBuffer()
  let percentage = 0
  let count = 0

  const loadNext = index => {
    const render = new FileReader()
    // 开始读取指定的 Blob中的内容, 一旦完成, 
    // result 属性中保存的将是被读取文件的 ArrayBuffer 数据对象.
    render.readAsArrayBuffer(fileChunkList[index].file)
    // 该事件在读取操作完成时触发
    render.onload = e => {
      count++
      spark.append(e.target.result)
      if (count === fileChunkList.length) {
        self.postMessage({
          percentage: 100,
          hash: spark.end()
        })
        self.close()
      } else {
        percentage += 100 / fileChunkList.length
        self.postMessage({
          percentage
        })
        loadNext(count)
      }
    }
  }
  loadNext(0)
}