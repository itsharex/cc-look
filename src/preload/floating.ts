import { contextBridge, ipcRenderer } from 'electron'

// 浮动窗口的 API
contextBridge.exposeInMainWorld('floatingApi', {
  onContent: (callback: (data: { content: string; type: string }) => void) => {
    ipcRenderer.on('floating:content', (_, data) => callback(data))
  },
  onTokens: (callback: (data: { input: number | null; output: number }) => void) => {
    ipcRenderer.on('floating:tokens', (_, data) => callback(data))
  },
  onFadeout: (callback: () => void) => {
    ipcRenderer.on('floating:fadeout', () => callback())
  },
  // 拖拽
  dragStart: () => {
    ipcRenderer.send('floating:dragstart')
  },
  drag: (dx: number, dy: number) => {
    ipcRenderer.send('floating:drag', { dx, dy })
  },
  dragEnd: (dx: number, dy: number) => {
    ipcRenderer.send('floating:dragend', { dx, dy })
  },
  hoverEnter: () => {
    ipcRenderer.send('floating:hoverEnter')
  },
  hoverLeave: () => {
    ipcRenderer.send('floating:hoverLeave')
  }
})
