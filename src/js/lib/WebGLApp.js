import * as THREE from 'three'
import createOrbitControls from 'orbit-controls'
import createTouches from 'touches'
import dataURIToBlob from 'datauritoblob'
import Stats from 'stats.js'
import State from 'controls-state'
import wrapGUI from 'controls-gui'
import { getGPUTier } from 'detect-gpu'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'

export default class WebGLApp {
  #updateListeners = []
  #tmpTarget = new THREE.Vector3()
  #rafID
  #lastTime

  constructor({
    background = '#000',
    backgroundAlpha = 1,
    fov = 45,
    near = 0.01,
    far = 100,
    ...options
  } = {}) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      failIfMajorPerformanceCaveat: true,
      ...options,
    })

    this.renderer.sortObjects = false
    this.canvas = this.renderer.domElement

    this.renderer.setClearColor(background, backgroundAlpha)

    this.maxPixelRatio = options.maxPixelRatio || 2
    this.maxDeltaTime = options.maxDeltaTime || 1 / 30

    this.camera = new THREE.PerspectiveCamera(fov, 1, near, far)

    this.scene = new THREE.Scene()

    this.gl = this.renderer.getContext()

    this.time = 0
    this.isRunning = false
    this.#lastTime = performance.now()
    this.#rafID = null

    const gpu = getGPUTier({ glContext: this.renderer.getContext() })
    this.gpu = {
      name: gpu.type,
      tier: Number(gpu.tier.slice(-1)),
      isMobile: gpu.tier.toLowerCase().includes('mobile'),
    }

    if (!options.width && !options.height) {
      window.addEventListener('resize', this.resize)
      window.addEventListener('orientationchange', this.resize)
    }

    this.resize({
      width: options.width,
      height: options.height,
    })

    this.touchHandler = createTouches(this.canvas, {
      target: this.canvas,
      filtered: true,
    })
    this.touchHandler.on('start', (ev, pos) => this.traverse('onPointerDown', ev, pos))
    this.touchHandler.on('move', (ev, pos) => this.traverse('onPointerMove', ev, pos))
    this.touchHandler.on('end', (ev, pos) => this.traverse('onPointerUp', ev, pos))

    if (options.postprocessing) {
      this.composer = new EffectComposer(this.renderer)
      this.composer.addPass(new RenderPass(this.scene, this.camera))
    }

    if (options.orbitControls) {
      this.orbitControls = createOrbitControls({
        element: this.canvas,
        parent: window,
        distance: 4,
        ...(options.orbitControls instanceof Object ? options.orbitControls : {}),
      })
    }

    if (options.world) this.world = options.world

    if (options.tween) this.tween = options.tween

    if (options.showFps) {
      this.stats = new Stats()
      this.stats.showPanel(0)
      document.body.appendChild(this.stats.dom)
    }

    if (options.controls) {
      const controlsState = State(options.controls)
      this.controls = options.hideControls ? controlsState : wrapGUI(controlsState)
      if (options.closeControls && !options.hideControls) {
        const controlsElement = document.querySelector('[class*="controlPanel"]')

        controlsElement.style.display = 'none'
        const controlsButton = document.querySelector('[class*="controlPanel"] button')
        controlsButton.click()
        controlsElement.style.display = 'block'
      }
    }
  }

  resize = ({
    width = window.innerWidth,
    height = window.innerHeight,
    pixelRatio = Math.min(this.maxPixelRatio, window.devicePixelRatio),
  } = {}) => {
    this.width = width
    this.height = height
    this.pixelRatio = pixelRatio

    if (this.renderer.getPixelRatio() !== pixelRatio) {
      this.renderer.setPixelRatio(pixelRatio)
    }

    this.renderer.setSize(width, height)
    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = width / height
    }
    this.camera.updateProjectionMatrix()

    if (this.composer) {
      this.composer.setSize(pixelRatio * width, pixelRatio * height)
    }

    this.scene.traverse(obj => {
      if (typeof obj.resize === 'function') {
        obj.resize({
          width,
          height,
          pixelRatio,
        })
      }
    })

    this.draw()
    return this
  }

  saveScreenshot = ({ width = 2560, height = 1440, fileName = 'image.png' } = {}) => {
    this.resize({ width, height, pixelRatio: 1 })
    this.draw()

    const dataURI = this.canvas.toDataURL('image/png')

    this.resize()
    this.draw()

    saveDataURI(fileName, dataURI)
  }

  update = (dt, time) => {
    if (this.orbitControls) {
      this.orbitControls.update()

      this.camera.up.fromArray(this.orbitControls.up)
      this.camera.position.fromArray(this.orbitControls.position)
      this.#tmpTarget.fromArray(this.orbitControls.target)
      this.camera.lookAt(this.#tmpTarget)
    }

    this.scene.traverse(obj => {
      if (typeof obj.update === 'function') {
        obj.update(dt, time)
      }
    })

    if (this.world) {
      this.world.step(dt)

      this.world.bodies.forEach(body => {
        if (typeof body.update === 'function') {
          body.update(dt, time)
        }
      })
    }

    if (this.tween) {
      this.tween.update()
    }

    this.#updateListeners.forEach(fn => fn(dt, time))

    return this
  }

  onUpdate(fn) {
    this.#updateListeners.push(fn)
  }

  draw = () => {
    if (this.composer) {
      this.composer.passes.forEach((pass, i, passes) => {
        const isLastElement = i === passes.length - 1

        if (isLastElement) {
          pass.renderToScreen = true
        } else {
          pass.renderToScreen = false
        }
      })

      this.composer.render()
    } else {
      this.renderer.render(this.scene, this.camera)
    }
    return this
  }

  start = () => {
    if (this.#rafID !== null) return
    this.#rafID = window.requestAnimationFrame(this.animate)
    this.isRunning = true
    return this
  }

  stop = () => {
    if (this.#rafID === null) return
    window.cancelAnimationFrame(this.#rafID)
    this.#rafID = null
    this.isRunning = false
    return this
  }

  animate = () => {
    if (!this.isRunning) return
    window.requestAnimationFrame(this.animate)

    if (this.stats) this.stats.begin()

    const now = performance.now()
    const dt = Math.min(this.maxDeltaTime, (now - this.#lastTime) / 1000)
    this.time += dt
    this.#lastTime = now
    this.update(dt, this.time)
    this.draw()

    if (this.stats) this.stats.end()
  }

  traverse = (fn, ...args) => {
    this.scene.traverse(child => {
      if (typeof child[fn] === 'function') {
        child[fn].apply(child, args)
      }
    })
  }
}

function saveDataURI(name, dataURI) {
  const blob = dataURIToBlob(dataURI)

  const link = document.createElement('a')
  link.download = name
  link.href = window.URL.createObjectURL(blob)
  link.onclick = setTimeout(() => {
    window.URL.revokeObjectURL(blob)
    link.removeAttribute('href')
  }, 0)

  link.click()
}
