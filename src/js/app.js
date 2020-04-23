import State from 'controls-state'
import WebGLApp from './lib/WebGLApp'
import assets from './lib/AssetManager'
import { addLights } from './scene/lights'
import { Slides } from './scene/Slides'
import { SlideNoise } from './scene/SlideNoise'
import '../css/app.css'

window.DEBUG = window.location.search.includes('debug')

window.IS_MOBILE = window.matchMedia('(max-width: 53em)').matches

const canvas = document.querySelector('#canvas')

const webgl = new WebGLApp({
  canvas,
  alpha: true,
  backgroundAlpha: 0,
  orbitControls: window.DEBUG && { distance: 5 },
  controls: {
    color: '#9e9b94',
    displacement: new State.Slider(0.6, { min: 0, max: 2, step: 0.01 }),
    delayFactor: new State.Slider(1.5, { min: 0, max: 10, step: 0.01 }),
    turbulence: {
      speed: new State.Slider(0.2, { min: 0, max: 3, step: 0.01 }),
      frequency: new State.Slider(0.5, { min: 0, max: 2, step: 0.01 }),
      amplitude: new State.Slider(0.2, { min: 0, max: 2, step: 0.01 }),
    },
  },
  closeControls: true,
  hideControls: true,
  height: window.IS_MOBILE ? 400 : undefined,
})

if (window.DEBUG) {
  window.webgl = webgl
}

webgl.canvas.style.visibility = 'hidden'

const IMAGES = ['images/1.jpg', 'images/2.jpg', 'images/3.jpg', 'images/4.jpg']

const firstImage = assets.queue({
  url: IMAGES.shift(),
  type: 'texture',
})

assets.load({ renderer: webgl.renderer }).then(() => {
  webgl.canvas.style.visibility = ''
  webgl.camera.position.set(0, 0, 5)

  addLights(webgl)

  webgl.scene.slides = new Slides(webgl, { firstImage, otherImages: IMAGES, Slide: SlideNoise })
  webgl.scene.add(webgl.scene.slides)
  
  webgl.start()
  webgl.draw()
})
