/**
 * 回归：浏览器在请求还没回来时关掉页面，不能把宿主进程带崩。
 *
 * 现场是一条 `ERR_STREAM_UNABLE_TO_PIPE`：客户端已经断开（`res.destroyed`），
 * 上游这时才回响应，代理在 `ClientRequest` 的 'response' 回调里直接
 * `pipeline(response, res)` —— 这个异常跑在回调里，没人接，被 Node 当成
 * uncaught exception，host 直接退出。
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createProxy } from '../lib/proxy.mjs'

const ACCESS_KEY = 'test-key'
const PROXY_PORT = 18871

let upstream
let proxy
let upstreamPort

/** 客户端请求，在指定时机把连接掐掉。 */
function abortRequest(path, when) {
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port: PROXY_PORT,
      path,
      headers: { cookie: `dsh-lan-access=${ACCESS_KEY}` }
    })
    req.on('error', () => resolve())
    if (when === 'before-response') {
      req.on('socket', (socket) => setTimeout(() => {
        socket.destroy()
        resolve()
      }, 20))
      req.end()
      return
    }
    req.on('response', (res) => {
      if (when === 'after-headers') {
        res.destroy()
        setTimeout(resolve, 40)
        return
      }
      res.once('data', () => {
        res.destroy()
        setTimeout(resolve, 40)
      })
    })
    req.end()
  })
}

before(async () => {
  upstream = http.createServer((req, res) => {
    // 代理启动时会用 launch token 换一次 cookie，这里得先应付过去
    if (req.url.startsWith('/?token=')) {
      res.writeHead(303, { 'set-cookie': 'dsh-auth-x=1; Path=/' })
      res.end()
      return
    }
    if (req.url === '/slow') {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'text/plain' })
        res.end('slow')
      }, 150)
      return
    }
    if (req.url === '/stream') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.write('a'.repeat(2048))
      const timer = setInterval(() => res.write('b'.repeat(2048)), 10)
      res.on('close', () => clearInterval(timer))
      return
    }
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('ok')
  })
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  upstreamPort = upstream.address().port

  proxy = createProxy({
    upstreamPort,
    getAccessKey: () => ACCESS_KEY,
    getLaunchToken: () => 'launch-token',
    allowPublic: true,
    log: () => {}
  })
  await proxy.start(PROXY_PORT, '127.0.0.1')
})

after(async () => {
  await proxy.stop()
  await new Promise((resolve) => upstream.close(resolve))
})

test('响应回来之前关页面', async () => {
  for (let i = 0; i < 5; i++) await abortRequest('/slow', 'before-response')
  // 崩了的话进程早就没了，这里根本跑不到
  assert.ok(true)
})

test('刚拿到响应头就关页面', async () => {
  for (let i = 0; i < 5; i++) await abortRequest('/stream', 'after-headers')
  assert.ok(true)
})

test('正在传大响应时关页面', async () => {
  for (let i = 0; i < 5; i++) await abortRequest('/stream', 'after-data')
  assert.ok(true)
})

test('断开之后代理还能正常服务', async () => {
  const body = await new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: PROXY_PORT,
      path: '/',
      headers: { cookie: `dsh-lan-access=${ACCESS_KEY}` }
    }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { text += chunk })
      res.on('end', () => resolve(text))
    })
    req.on('error', reject)
    req.end()
  })
  assert.equal(body, 'ok')
})
