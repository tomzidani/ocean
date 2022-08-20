import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"

import fragment from "./shaders/fragment.glsl"
import vertex from "./shaders/vertex.glsl"

import oceanImg from "../img/ocean.jpg"
import imagesLoaded from "imagesloaded"
import FontFaceObserver from "fontfaceobserver"

export default class Sketch {
  constructor(opts) {
    this.time = 0
    this.container = opts.dom

    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 100, 2000)
    this.camera.position.z = 600

    this.camera.fov = 2 * Math.atan((this.height / 2 / 600) * (100 / Math.PI))

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(this.width, this.height)
    this.container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)

    this.images = [...Array.from(document.querySelectorAll("img"))]

    const fontOpen = new Promise((res) => {
      new FontFaceObserver("Helvetica Neue").load().then(() => res())
    })

    const preloadImages = new Promise((res) => {
      imagesLoaded(document.querySelectorAll("img"), { background: true }, () => res())
    })

    let allDone = [fontOpen, preloadImages]

    Promise.all(allDone).then(() => {
      this.addImages()
      this.setPosition()

      this.addObjects()
      this.render()

      this.bindEvents()
    })
  }

  bindEvents() {
    window.addEventListener("resize", this.resize.bind(this))
  }

  resize() {
    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight
    this.renderer.setSize(this.width, this.height)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  setPosition() {
    this.imageStore.forEach((o) => {
      o.mesh.position.y = -o.top + this.height / 2 - o.height / 2
      o.mesh.position.x = o.left - this.width / 2 + o.width / 2
    })
  }

  addImages() {
    this.imageStore = this.images.map((img) => {
      const bounds = img.getBoundingClientRect()

      const geometry = new THREE.PlaneBufferGeometry(img.width, img.height, 1, 1)

      let image = new Image()
      image.src = img.src
      let texture = new THREE.Texture(image)
      texture.needsUpdate = true

      const material = new THREE.MeshBasicMaterial({ map: texture })

      const mesh = new THREE.Mesh(geometry, material)

      this.scene.add(mesh)

      return {
        img: img,
        mesh: mesh,
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      }
    })
  }

  addObjects() {
    this.geometry = new THREE.PlaneBufferGeometry(200, 400, 10, 10)
    this.material = new THREE.MeshNormalMaterial()

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        oceanTexture: { value: new THREE.TextureLoader().load(oceanImg) },
      },
      side: THREE.DoubleSide,
      fragmentShader: fragment,
      vertexShader: vertex,
      wireframe: true,
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.scene.add(this.mesh)
  }

  render() {
    this.time += 0.05

    this.mesh.rotation.x = this.time / 2000
    this.mesh.rotation.y = this.time / 1000

    this.material.uniforms.time.value = this.time

    this.renderer.render(this.scene, this.camera)
    window.requestAnimationFrame(this.render.bind(this))
  }
}

new Sketch({
  dom: document.querySelector(".app-container"),
})
