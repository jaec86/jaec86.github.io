import pMap from 'p-map'
import prettyMs from 'pretty-ms'
import loadImage from 'image-promise'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import loadTexture from './loadTexture'
import loadEnvMap from './loadEnvMap'

process.env.PUBLIC_URL = window.location.pathname.slice(
  0,
  window.location.pathname.lastIndexOf('/') + 1
)

class AssetManager {
  #queue = []
  #cache = {}
  #onProgressListeners = []
  #asyncConcurrency = 10
  #logs = []

  addProgressListener(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('onProgress must be a function')
    }
    this.#onProgressListeners.push(fn)
  }

  queue({ url, type, ...options }) {
    if (!url) throw new TypeError('Must specify a URL or opt.url for AssetManager.queue()')
    if (!this._getQueued(url)) {
      this.#queue.push({ url, type: type || this._extractType(url), ...options })
    }

    return url
  }

  _getQueued(url) {
    return this.#queue.find(item => item.url === url)
  }

  _extractType(url) {
    const ext = url.slice(url.lastIndexOf('.'))

    switch (true) {
      case /\.(gltf|glb)$/i.test(ext):
        return 'gltf'
      case /\.json$/i.test(ext):
        return 'json'
      case /\.svg$/i.test(ext):
        return 'svg'
      case /\.(jpe?g|png|gif|bmp|tga|tif)$/i.test(ext):
        return 'image'
      case /\.(wav|mp3)$/i.test(ext):
        return 'audio'
      case /\.(mp4|webm|ogg|ogv)$/i.test(ext):
        return 'video'
      default:
        throw new Error(`Could not load ${url}, unknown file extension!`)
    }
  }

  get = url => {
    if (!url) throw new TypeError('Must specify an URL for AssetManager.get()')
    if (!(url in this.#cache)) {
      throw new Error(`The asset ${url} is not in the loaded files.`)
    }

    return this.#cache[url]
  }

  async loadSingle({ renderer, ...item }) {
    if (!renderer) {
      throw new Error('You must provide a renderer to the loadSingle function.')
    }

    try {
      const itemLoadingStart = Date.now()

      this.#cache[item.url] = await this._loadItem({ renderer, ...item })

      if (window.DEBUG) {
        console.log(
          `📦 Loaded single asset %c${item.url}%c in ${prettyMs(Date.now() - itemLoadingStart)}`,
          'color:blue',
          'color:black'
        )
      }

      return item.url
    } catch (err) {
      delete this.#cache[item.url]
      console.error(`📦  Could not load ${item.url}:\n${err}`)
    }
  }

  async load({ renderer }) {
    if (!renderer) {
      throw new Error('You must provide a renderer to the load function.')
    }

    const queue = this.#queue.slice()
    this.#queue.length = 0 // clear queue

    const total = queue.length
    if (total === 0) {
      setTimeout(() => this.#onProgressListeners.forEach(fn => fn(1)), 0)
      return
    }

    const loadingStart = Date.now()

    await pMap(
      queue,
      async (item, i) => {
        try {
          const itemLoadingStart = Date.now()

          this.#cache[item.url] = await this._loadItem({ renderer, ...item })

          if (window.DEBUG) {
            this.log(
              `Loaded %c${item.url}%c in ${prettyMs(Date.now() - itemLoadingStart)}`,
              'color:blue',
              'color:black'
            )
          }
        } catch (err) {
          this.logError(`Skipping ${item.url} from asset loading:\n${err}`)
        }

        const percent = (i + 1) / total
        this.#onProgressListeners.forEach(fn => fn(percent))
      },
      { concurrency: this.#asyncConcurrency }
    )

    if (window.DEBUG) {
      const errors = this.#logs.filter(log => log.type === 'error')

      this.groupLog(
        `📦 Assets loaded in ${prettyMs(Date.now() - loadingStart)} ⏱ ${
          errors.length > 0
            ? `%c ⚠️ Skipped ${errors.length} asset${errors.length > 1 ? 's' : ''} `
            : ''
        }`,
        errors.length > 0 ? 'color:white;background:red;' : ''
      )
    }
  }

  async _loadItem({ url, type, renderer, ...options }) {
    if (url in this.#cache) {
      return this.#cache[url]
    }

    url = `${process.env.PUBLIC_URL}${url}`

    switch (type) {
      case 'gltf':
        return new Promise((resolve, reject) => {
          new GLTFLoader().load(url, resolve, null, err =>
            reject(new Error(`Could not load GLTF asset ${url}:\n${err}`))
          )
        })
      case 'json':
        return fetch(url).then(response => response.json())
      case 'env-map':
        return loadEnvMap(url, { renderer, ...options })
      case 'svg':
      case 'image':
        return loadImage(url, { crossorigin: 'anonymous' })
      case 'texture':
        return loadTexture(url, { renderer, ...options })
      case 'audio':
        return fetch(url).then(response => response.arrayBuffer())
      case 'video':
        return fetch(url).then(response => response.blob())
      default:
        throw new Error(`Could not load ${url}, the type ${type} is unknown!`)
    }
  }

  log(...text) {
    this.#logs.push({ type: 'log', text })
  }

  logError(...text) {
    this.#logs.push({ type: 'error', text })
  }

  groupLog(...text) {
    console.groupCollapsed(...text)
    this.#logs.forEach(log => {
      console[log.type](...log.text)
    })
    console.groupEnd()

    this.#logs.length = 0 // clear logs
  }
}

export default new AssetManager()