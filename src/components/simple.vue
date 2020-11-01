<template>
  <div class="simpel-upload-container">
    <div class="total-progress">
      <div class="btns">
        <el-button-group>
          <el-button :disabled="changeDisabled" icon="el-icon-upload2"
            >选择文件
            <input
              v-if="!changeDisabled"
              type="file"
              :multiple="multiple"
              class="select-file-input"
              :accept="accept"
              @change="handleFileChange"
            />
          </el-button>
          <el-button
            :disabled="uploadDisabled"
            @click="handleUpload"
            icon="el-icon-upload"
            >上传</el-button
          >
          <el-button
            :disabled="pauseDisabled"
            @click="handlePause"
            icon="el-icon-video-pause"
            >暂停</el-button
          >
          <el-button
            :disabled="resumeDisabled"
            @click="handleResume"
            icon="el-icon-video-play"
            >恢复</el-button
          >
          <el-button
            :disabled="clearDisabled"
            @click="clearFiles"
            icon="el-icon-delete"
            >清空</el-button
          >
        </el-button-group>
        <slot name="header"></slot>
      </div>
    </div>

    <div class="file-list">
      <el-collapse v-if="uploadFiles.length" accordion>
        <el-collapse-item v-for="(item, index) in uploadFiles" :key="index">
          <template slot="title">
            <div class="progress-box">
              <div class="list-item">
                <div class="item-name">
                  <span>{{ index + 1 }}: 名称: {{ item.name }}</span>
                </div>
                <div class="item-size">
                  大小: {{ $utils.formatByte(item.size) }}
                </div>
                <div v-if="item.hashProgress !== 100" class="item-progress">
                  <span
                    >{{
                      status === 'wait' ? '准备读取文件' : '正在读取文件'
                    }}：</span
                  >
                  <el-progress :percentage="item.hashProgress" />
                </div>
                <div v-else class="item-progress">
                  <span>文件进度</span>
                  <el-progress :percentage="item.uploadProgress" />
                </div>
                <div class="item-status">
                  <i :class="fileStatuIcon(item.status)"></i>
                  {{ item.status | fileStatus }}
                </div>
              </div>
            </div>
          </template>
          <div class="item-chunk-box">
            <el-table :data="item.chunkList" border max-height="300">
              <el-table-column prop="index" label="#" align="center" />
              <el-table-column
                prop="hash"
                label="切片md5"
                align="center"
                show-overflow-tooltip
              />
              <el-table-column label="大小" align="center" width="120">
                <template v-slot="{ row }">
                  {{ $utils.formatByte(row.size) }}
                </template>
              </el-table-column>
              <el-table-column prop="uploaded" label="是否完成" align="center">
                <template v-slot="{ row }">
                  {{ row.uploaded ? '完成' : '进行中' }}
                </template>
              </el-table-column>

              <el-table-column label="进度" align="center">
                <template v-slot="{ row }">
                  <el-progress
                    v-if="!row.status || row.status === 'wait'"
                    :percentage="row.progress"
                  />
                  <el-progress
                    v-else
                    :percentage="row.progress"
                    :status="row.status"
                  />
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>
    <slot name="tip"></slot>
  </div>
</template>

<script>
import { Status, fileStatus } from '@/utils/config'
import {
  addChunkStorage,
  getChunkStorage,
  clearLocalStorage,
} from '@/utils/localstorage'
import { formatByte } from '@/utils/common'
import axios, { CancelToken } from 'axios'

const instance = axios.create({})

let chunkSize = 10 * 1024 * 1024 // 切片大小
let fileIndex = 0 // 当前正在被遍历的文件下标

export default {
  name: 'SimpleUploaderContainer',
  filters: {
    fileStatus(status) {
      return fileStatus[status].name
    },
  },
  props: {
    accept: {
      type: String,
      default: '',
    },
    multiple: {
      type: Boolean,
      default: true,
    },
    // 文件个数
    limit: {
      type: Number,
      default: 20,
    },
    // 文件超出个数限制时的钩子
    onExceed: {
      type: Function,
      default: () => {},
    },
    baseUrl: {
      type: String,
      default: '',
    },
    headers: {
      type: Object,
      default: () => ({}),
    },
    // 是否传递cookie
    withCredentials: {
      type: Boolean,
      default: false,
    },
    beforeUpload: {
      type: Function,
      default: null,
    },
    // 切片大小
    chunkSize: {
      type: Number,
      default: 10 * 1024 * 1024,
    },
    // 上传并发数
    threads: {
      type: Number,
      default: 3,
    },
  },
  data() {
    return {
      status: Status.wait, // 默认状态
      uploadFiles: [],
      worker: null, // web worker
      tempThreads: 3,
      cancels: [], // 存储要取消的请求
    }
  },
  created() {
    this.setAxios()
    this.tempThreads = this.threads
  },
  destroyed() {
    this.clearFiles()
  },
  methods: {
    setAxios() {
      // 设置baseUrl
      if (this.baseUrl) {
        instance.defaults.baseURL = this.baseUrl
      }
      for (const i in this.headers) {
        instance.defaults.headers.common[i] = this.headers[i]
      }
      // 跨域也可携带cookie
      if (this.withCredentials) {
        instance.defaults.withCredentials = true
      }
      // 设置切片大小
      chunkSize = this.chunkSize
    },
    handleFileChange(e) {
      const files = e.target.files
      console.log('handleFileChange -> file', files)
      if (!files) return

      // 重置文件下标
      fileIndex = 0 // 重置文件下标
      // 判断文件选择的个数
      if (this.limit && files.length > this.limit) {
        this.onExceed && this.onExceed(files)
        return
      }

      this.status = Status.wait

      const postFiles = Array.prototype.slice.call(files)
      console.log('file -> postFiles', postFiles)
      postFiles.forEach((item) => {
        this.handleStart(item)
      })
    },
    // 格式化files、beforeUpload钩子处理、文件的追加也是通过此函数控制
    handleStart(rawFile) {
      // 初始化部分自定义属性
      rawFile.status = fileStatus.wait.code
      rawFile.chunkList = []
      rawFile.hashProgress = 0
      rawFile.uploadProgress = 0
      rawFile.fakeUploadProgress = 0 // 假进度条，处理恢复上传后，进度条后移的问题

      if (this.beforeUpload) {
        const before = this.beforeUpload(rawFile)
        if (before && before.then) {
          before.then((res) => {
            this.uploadFiles.push(rawFile)
          })
        }
      } else {
        this.uploadFiles.push(rawFile)
      }
    },
    async handleUpload() {
      console.log('handleUpload -> this.uploadFiles', this.uploadFiles)
      if (!this.uploadFiles) return
      this.status = Status.uploading
      const filesArr = this.uploadFiles

      // 对单个文件逐一上传
      for (let i = 0; i < filesArr.length; i++) {
        fileIndex = i
        if (['secondPass', 'success', 'error'].includes(filesArr[i].status)) {
          console.log('跳过已经上传成功或已秒传的或失败的file')
          continue
        }

        // 文件切片
        const fileChunkList = this.createFileChunk(filesArr[i])

        // 若不是恢复, 再进行hash计算
        if (filesArr[i].status !== 'resume') {
          this.status = Status.hash
          // hash校验, 是否为秒传
          filesArr[i].hash = await this.calculateHash(fileChunkList)

          // 若清空或者状态为等待, 则跳出循环
          if (this.status === Status.wait) {
            console.log('若清空或者状态为等待，则跳出循环')
            break
          }

          console.log('handleUpload -> hash', filesArr[i])
        }

        this.status = Status.uploading

        // 检验文件重复
        const verifyRes = await this.verifyUpload(
          filesArr[i].name,
          filesArr[i].hash
        )
        if (verifyRes.data.presence) {
          console.log('文件重复', verifyRes)
          filesArr[i].status = fileStatus.secondPass.code
          filesArr[i].uploadProgress = 100
          // 判断是否都已经上传
          this.isAllStatus()
        } else {
          console.log('开始上传文件=======>', filesArr[i].name)
          filesArr[i].status = fileStatus.uploading.code

          const chunkStorage = getChunkStorage(filesArr[i].hash)
          filesArr[i].fileHash = filesArr[i].hash // 文件的hash, 合并时使用
          // 自定义chunkList(切片)
          filesArr[i].chunkList = fileChunkList.map(({ file }, index) => ({
            fileHash: filesArr[i].hash,
            fileName: filesArr[i].name,
            index,
            hash: filesArr[i].hash + '-' + index,
            chunk: file,
            size: file.size,
            uploaded: chunkStorage && chunkStorage.includes(index), // 标识: 是否已经完成上传
            progress: chunkStorage && chunkStorage.includes(index) ? 100 : 0,
            status:
              chunkStorage && chunkStorage.includes(index) ? 'success' : 'wait', // 上传状态, 用作进度状态显示
          }))

          this.$set(filesArr, i, filesArr[i])

          console.log('handleUpload ->  this.chunkData', filesArr[i])
          await this.uploadChunks(filesArr[i])
        }
      }
    },
    // 将切片传输给服务端
    async uploadChunks(data) {
      console.log('uploadChunks -> data', data)
      let chunkData = data.chunkList
      const requestDataList = chunkData
        .filter(({ uploaded }) => !uploaded)
        .map(({ fileHash, chunk, fileName, index }) => {
          const formData = new FormData()
          formData.append('md5', fileHash)
          formData.append('file', chunk)
          formData.append('chunkId', index) // 文件名使用切片的下标
          return { formData, index, fileName }
        })

      console.log('uploadChunks -> requestDataList', requestDataList)

      // 并发上传
      try {
        const ret = await this.sendRequest(requestDataList, chunkData)
        console.log('uploadChunks -> chunkData', chunkData)
        console.log('ret', ret)
      } catch (error) {
        // 上传有被reject的
        this.$message.error('亲 上传失败了, 考虑重试下呦' + error)
        return
      }

      //合并切片
      const isUpload = chunkData.some((item) => item.uploading === false)
      if (isUpload) {
        alert('存在失败的切片')
      } else {
        // 执行合并
        try {
          await this.mergeRequest(data)
        } catch (error) {
          console.error(error)
        }
      }
    },
    // 并发处理
    sendRequest(froms, chunkData) {
      console.log('sendRequest -> forms', froms)
      console.log('sendRequest -> chunkData', chunkData)
      let finished = 0
      const total = froms.length
      const self = this
      const retryArr = [] // 数组存储每个文件hash请求的重试次数, 就是第0个文件切片报错1次
      const chunkRetry = 3 // 重试限制次数(3次)

      return new Promise((resolve, reject) => {
        const handler = () => {
          console.log('handler -> forms', froms)
          if (froms.length) {
            // 出栈
            const formInfo = froms.shift()

            const formData = formInfo.formData
            const index = formInfo.index

            instance
              .post('fileChunk', formData, {
                onUploadProgress: self.createProgresshandler(chunkData[index]),
                cancelToken: new CancelToken((c) => this.cancels.push(c)),
              })
              .then((res) => {
                console.log('handler -> res', res)
                // 更改状态
                chunkData[index].uploaded = true
                chunkData[index].status = 'success'
                // 存储已上传的切片下标
                addChunkStorage(chunkData[index].fileHash, index)

                finished++
                handler()
              })
              .catch((e) => {
                // 若状态为暂停或等待, 则禁止重试
                console.log('handler -> this.status', this.status)
                if ([Status.pause, Status.wait].includes(this.status)) return

                console.warn('出现错误', e)
                console.log('handler -> retryArr', retryArr)
                if (typeof retryArr[index] !== 'number') {
                  retryArr[index] = 0
                }

                // 更新状态
                chunkData[index].status = 'warning'

                // 累加错误次数
                retryArr[index]++

                // 重试3次
                if (retryArr[index] >= chunkRetry) {
                  console.warn(
                    '重试失败 ---> handler -> retryArr',
                    retryArr,
                    chunkData[index].hash
                  )
                  return reject('重试失败', retryArr)
                }

                console.log(
                  'handler -> retryArr[finished]',
                  `${chunkData[index].hash}--进行第${retryArr[index]}'次重试'`
                )
                console.log(retryArr)

                this.tempThreads++ // 释放当前占用的通道 ？？？

                // 将失败的重新加入队列
                froms.push(formInfo)
                handler()
              })
          }
          if (finished >= total) {
            resolve('done')
          }
        }

        // for循环控制并发的初始并发数, 然后在handler函数里调用自己
        for (let i = 0; i < this.tempThreads; i++) {
          handler()
        }
      })
    },
    // 通知服务器合并切片
    mergeRequest(data) {
      const obj = {
        md5: data.fileHash,
        fileName: data.name,
        fileChunkNum: data.chunkList.length,
      }

      instance
        .post('fileChunk/merge', obj, {
          timeout: 0,
        })
        .then((res) => {
          // 清除storage
          if (res.data.code === 200) {
            data.status = fileStatus.success.code
            console.log('mergeRequest -> data', data)
            console.log('上传的chunk', localStorage.getItem(data.fileHash))
            clearLocalStorage(data.fileHash)
            // 判断是否所有都成功上传
            this.isAllStatus()
          } else {
            // 文件块数量不对, 清楚缓存
            clearLocalStorage(data.fileHash)
            data.status = fileStatus.error.code
            this.status = Status.wait
          }
        })
        .catch((error) => {
          console.log('mergeRequest -> err', error)
          data.status = fileStatus.error
        })
    },
    // 创建文件切片
    createFileChunk(file, size = chunkSize) {
      const fileChunkList = []
      let count = 0
      while (count < file.size) {
        fileChunkList.push({
          file: file.slice(count, count + size),
        })
        count += size
      }
      console.log('createFileChunk -> fileChunkList', fileChunkList)
      return fileChunkList
    },
    // 生成文件hash (web-worker)
    calculateHash(fileChunkList) {
      console.log('calculateHash -> fileChunkList', fileChunkList)
      return new Promise((resolve) => {
        this.worker = new Worker('./hash-worker.js')
        this.worker.postMessage({ fileChunkList })
        this.worker.onmessage = (e) => {
          const { percentage, hash } = e.data
          if (this.uploadFiles[fileIndex]) {
            this.uploadFiles[fileIndex].hashProgress = Number(
              percentage.toFixed(0)
            )
            this.$set(this.uploadFiles, fileIndex, this.uploadFiles[fileIndex])
          }
          if (hash) {
            resolve(hash)
          }
        }
      })
    },
    // 文件上传之前的校验: 校验文件是否已存在
    verifyUpload(fileName, fileHash) {
      return new Promise((resolve) => {
        const obj = {
          md5: fileHash,
          fileName,
        }
        //
        instance
          .get('fileChunk/presence', { params: obj })
          .then((res) => {
            console.log('verifyUpload -> res', res)
            resolve(res.data)
          })
          .catch((err) => {
            console.log('verifyUpload -> err', err)
          })
      })
    },
    // 切片上传进度
    createProgresshandler(chunk) {
      console.log('createProgresshandler -> chunk', chunk)
      return (progress) => {
        chunk.progress = parseInt(
          String(progress.loaded / progress.total) * 100
        )
        this.fileProgress()
      }
    },
    // 文件总进度
    fileProgress() {
      const currentFile = this.uploadFiles[fileIndex]
      if (currentFile) {
        const uploadProgress = currentFile.chunkList
          .map((item) => item.size * item.progress)
          .reduce((acc, cur) => acc + cur)
        const currentFileProgress = parseInt(
          (uploadProgress / currentFile.size).toFixed(2)
        )

        // 真假进度条处理--处理进度条后移
        if (!currentFile.fakeUploadProgress) {
          currentFile.uploadProgress = currentFileProgress
          this.$set(this.uploadFiles, fileIndex, currentFile)
        } else if (currentFileProgress > currentFile.fakeUploadProgress) {
          currentFile.uploadProgress = currentFileProgress
          this.$set(this.uploadFiles, fileIndex, currentFile)
        }
      }
    },
    isAllStatus() {
      const isAllSuccess = this.uploadFiles.every((item) =>
        ['success', 'secondPass', 'error'].includes(item.status)
      )
      console.log('mergeRequest -> isAllSuccess', isAllSuccess)
      if (isAllSuccess) {
        this.status = Status.done
        this.$emit('success')
      }
    },
    // 暂停上传
    handlePause() {
      this.status = Status.pause
      if (this.uploadFiles.length) {
        const currentFile = this.uploadFiles[fileIndex]
        currentFile.status = fileStatus.pause.code
        // 将当前进度赋值给假进度条
        currentFile.fakeUploadProgress = currentFile.uploadProgress
        console.log('handlePause -> currentFile', currentFile)
      }
      while (this.cancels.length > 0) {
        this.cancels.pop()('取消请求')
      }
    },
    // 恢复上传
    handleResume() {
      this.status = Status.uploading
      console.log(
        'handleResume -> this.uploadFiles[fileIndex]',
        this.uploadFiles[fileIndex]
      )
      this.uploadFiles[fileIndex].status = fileStatus.resume.code
      this.handleUpload()
    },
    // 清空文件
    clearFiles() {
      console.log('清空文件')
      fileIndex = 0
      this.handlePause()

      this.worker && this.worker.terminate() // terminate立即终止Worker的行为
      this.status = Status.wait
      // 重置data所有数据
      Object.assign(this.$data, this.$options.data())
    },
  },
  computed: {
    changeDisabled() {
      return ![Status.wait, Status.done].includes(this.status)
    },
    uploadDisabled() {
      return (
        !this.uploadFiles.length ||
        [Status.pause, Status.done, Status.uploading, Status.hash].includes(
          this.status
        )
      )
    },
    pauseDisabled() {
      return [Status.wait, Status.hash, Status.pause, Status.done].includes(
        this.status
      )
    },
    resumeDisabled() {
      return ![Status.pause].includes(this.status)
    },
    clearDisabled() {
      return !this.uploadFiles.length
    },
    fileStatuIcon(status) {
      return function(status) {
        let className = ''
        switch (status) {
          case 'uploading':
            className = 'el-icon-loading'
            break
          case 'success':
          case 'secondPass':
            className = 'el-icon-circle-check'
            break
          case 'error':
            className = 'el-icon-circle-close'
            break
        }
        return className
      }
    },
  },
}
</script>

<style scoped lang="scss">
.simpel-upload-container {
  border: 1px solid #d2d2d2;
  border-radius: 4px;
  background-color: #fff;
  padding: 10px;
  margin-bottom: 20px;
  .total-progress {
    margin-bottom: 15px;
    .btns {
      position: relative;
      .select-file-input {
        position: absolute;
        display: inline-block;
        left: 0;
        top: 0;
        border: none;
        opacity: 0;
        width: 96px;
        height: 28px;
      }
    }
  }

  .file-list {
    .progress-box {
      width: 100%;

      .list-item {
        padding: 8px 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        line-height: 25px;
        position: relative;

        div {
          flex: 1;
        }
        .item-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-right: 6px;
        }
        .item-size {
          flex: 0 0 10%;
        }
        .item-progress {
          flex: 0 0 60%;
        }
        .item-status {
          flex: 0 0 10%;
          text-align: left;
          .el-icon-circle-check {
            color: #67c23a;
          }
          .el-icon-circle-close {
            color: #f00;
          }
        }
      }
    }
  }

  .el-progress {
    width: 80%;
    display: inline-block;
  }
  .upload-tip {
    font-size: 12px;
    color: #606266;
    margin-top: 7px;
  }
}
</style>
