import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"

import fragment from "./shaders/fragment.glsl"
import vertex from "./shaders/vertex.glsl"
import noise from "./shaders/noise.glsl"

import oceanImg from "../img/ocean.jpg"
import imagesLoaded from "imagesloaded"
import FontFaceObserver from "fontfaceobserver"
import Scroll from "./scroll"
import gsap from "gsap"

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"

export default class Sketch {
  constructor(opts) {
    this.time = 0
    this.container = opts.dom

    this.currentScroll = 0
    this.previousScroll = -1

    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 100, 2000)
    this.camera.position.z = 659

    this.camera.fov = 2 * Math.atan((this.height / 2 / 600) * (100 / Math.PI))

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
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

    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    Promise.all(allDone).then(() => {
      this.scroll = new Scroll()
      this.addImages()
      this.setPosition()

      this.mouseMovement()
      this.composerPass()
      // this.addObjects()
      this.render()

      this.bindEvents()
    })
  }

  composerPass() {
    this.composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)

    //custom shader pass
    var counter = 0.0
    this.myEffect = {
      uniforms: {
        tDiffuse: { value: null },
        scrollSpeed: { value: null },
        time: { value: null },
      },
      vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix 
          * modelViewMatrix 
          * vec4( position, 1.0 );
      }
      `,
      fragmentShader: `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      uniform float scrollSpeed;
      uniform float time;
      ${noise}
      void main(){
        vec2 newUV = vUv;
        float area = smoothstep(1.,0.8,vUv.y)*2. - 1.;
        float area1 = smoothstep(0.4,0.0,vUv.y);
        area1 = pow(area1,4.);
        float noise = 0.5*(cnoise(vec3(vUv*10.,time/5.)) + 1.);
        float n = smoothstep(0.5,0.51, noise + area/2.);
        newUV.x -= (vUv.x - 0.5)*0.1*area1*scrollSpeed;
        gl_FragColor = texture2D( tDiffuse, newUV);
      //   gl_FragColor = vec4(n,0.,0.,1.);
      gl_FragColor = mix(vec4(1.),texture2D( tDiffuse, newUV),n);
      // gl_FragColor = vec4(area,0.,0.,1.);
      }
      `,
    }

    this.customPass = new ShaderPass(this.myEffect)
    this.customPass.renderToScreen = true

    this.composer.addPass(this.customPass)
  }

  mouseMovement(e) {
    window.addEventListener(
      "mousemove",
      (e) => {
        this.mouse.x = (e.clientX / this.width) * 2 - 1
        this.mouse.y = -(e.clientY / this.height) * 2 + 1

        this.raycaster.setFromCamera(this.mouse, this.camera)

        const intersects = this.raycaster.intersectObjects(this.scene.children)

        if (intersects.length) {
          let obj = intersects[0].object
          obj.material.uniforms.hover.value = intersects[0].uv
        }
      },
      false
    )
  }

  bindEvents() {
    window.addEventListener("resize", this.resize.bind(this))
    // window.addEventListener("scroll", () => {
    //   this.currentScroll = window.scrollY
    //   this.setPosition()
    // })
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
      o.mesh.position.y = this.currentScroll - o.top + this.height / 2 - o.height / 2
      o.mesh.position.x = o.left - this.width / 2 + o.width / 2
    })
  }

  addImages() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uImage: { value: 0 },
        hover: { value: new THREE.Vector2(0.5, 0.5) },
        hoverState: { value: 0 },
        oceanTexture: { value: new THREE.TextureLoader().load(oceanImg) },
      },
      side: THREE.DoubleSide,
      fragmentShader: fragment,
      vertexShader: vertex,
    })

    this.materials = []

    this.imageStore = this.images.map((img) => {
      const bounds = img.getBoundingClientRect()

      const geometry = new THREE.PlaneBufferGeometry(1, 1, 10, 10)

      let image = new Image()
      image.src = img.src
      let texture = new THREE.Texture(image)
      texture.needsUpdate = true

      const material = this.material.clone()

      img.addEventListener("mouseenter", () => {
        gsap.to(material.uniforms.hoverState, {
          duration: 1,
          value: 1,
        })
      })

      img.addEventListener("mouseout", () => {
        gsap.to(material.uniforms.hoverState, {
          duration: 1,
          value: 0,
        })
      })

      this.materials.push(material)

      material.uniforms.uImage.value = texture

      const mesh = new THREE.Mesh(geometry, material)
      mesh.scale.set(bounds.width, bounds.height, 1)

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

    this.scroll.render()
    this.previousScroll = this.currentScroll
    this.currentScroll = this.scroll.scrollToRender

    if (Math.round(this.currentScroll) !== Math.round(this.previousScroll)) {
      this.setPosition()

      this.customPass.uniforms.scrollSpeed.value = this.scroll.speedTarget
      this.customPass.uniforms.time.value = this.time

      this.materials.forEach((m) => {
        m.uniforms.time.value = this.time
      })

      this.composer.render()
    }

    this.renderer.render(this.scene, this.camera)
    window.requestAnimationFrame(this.render.bind(this))
  }
}

new Sketch({
  dom: document.querySelector(".app-container"),
})
