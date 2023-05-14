import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { GameLoader } from "./loaders/game-loader";
import { KeyboardManager } from "./keyboard-manager";

export class GameState {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer: { x: number; y: number } = { x: 0, y: 0 };
  private keyboardManager?: KeyboardManager;

  constructor(
    private canvas: HTMLCanvasElement,
    private gameLoader: GameLoader
  ) {
    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.01,
      10
    );
    this.camera.position.z = 0.25;
    this.camera.position.y = 0.3;

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    THREE.ColorManagement.legacyMode = false;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    window.addEventListener("resize", this.onCanvasResize);
    this.onCanvasResize();

    //this.scene.background = new THREE.Color("#5a2db4");

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);

    const directLight = new THREE.DirectionalLight();
    this.scene.add(directLight);

    // Add keyboard
    const keyboard = this.gameLoader.modelLoader.get("keyboard");
    if (keyboard) {
      this.keyboardManager = new KeyboardManager(keyboard);
      this.scene.add(keyboard);
    }

    // Input listeners
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("touchstart", this.onTouchStart);
    document.addEventListener("touchend", this.onTouchEnd);

    // Start game
    this.update();
  }

  private onCanvasResize = () => {
    this.renderer.setSize(
      this.canvas.clientWidth,
      this.canvas.clientHeight,
      false
    );

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;

    this.camera.updateProjectionMatrix();
  };

  private update = () => {
    requestAnimationFrame(this.update);

    this.renderer.render(this.scene, this.camera);
    this.controls.update();
  };

  private getPointerPosition(x: number, y: number) {
    this.pointer.x = (x / window.innerWidth) * 2 - 1;
    this.pointer.y = -(y / window.innerHeight) * 2 + 1;
  }

  private onMouseDown = (event: MouseEvent) => {
    this.getPointerPosition(event.clientX, event.clientY);

    this.intersectCheck();
  };

  private onMouseUp = () => {
    // Stop playing keys
    this.keyboardManager?.resetKeys();
  };

  private onTouchStart = (event: TouchEvent) => {
    if (event.changedTouches.length) {
      this.getPointerPosition(
        event.changedTouches[0].clientX,
        event.changedTouches[0].clientY
      );
      this.intersectCheck();
    }
  };

  private onTouchEnd = () => {
    this.keyboardManager?.resetKeys();
  };

  private intersectCheck() {
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObjects(this.scene.children);
    if (!intersects.length) {
      return;
    }

    // Get object hit
    const object = intersects[0].object;

    this.keyboardManager?.onIntersectObject(object);
  }
}
