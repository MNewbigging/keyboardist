import * as THREE from "three";
import * as Tone from "tone";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { GameLoader } from "./loaders/game-loader";
import { addGui } from "./utils/utils";

export class GameState {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer: { x: number; y: number } = { x: 0, y: 0 };
  private polySynth = new Tone.PolySynth().toDestination();
  private playingKeys: string[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private gameLoader: GameLoader
  ) {
    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100
    );
    this.camera.position.z = 1.6;
    this.camera.position.y = 1.2;

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ canvas });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    THREE.ColorManagement.legacyMode = false;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    window.addEventListener("resize", this.onCanvasResize);
    this.onCanvasResize();

    this.scene.background = new THREE.Color("#c04df9");

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);

    const directLight = new THREE.DirectionalLight();
    this.scene.add(directLight);

    // Add box
    const box = this.gameLoader.modelLoader.get("keyboard");
    if (box) {
      addGui(box, "box");
      this.scene.add(box);
    }

    // Input listeners
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerdown", this.onPointerDown);
    document.addEventListener("pointerup", this.onPointerUp);

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

  private getPointerPosition(event: MouseEvent) {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  private onMouseMove = (event: MouseEvent) => {
    this.getPointerPosition(event);
  };

  private onPointerDown = (event: PointerEvent) => {
    this.getPointerPosition(event);

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObjects(this.scene.children);
    if (!intersects.length) {
      return;
    }

    // Get object hit
    const object = intersects[0].object;

    // Was it a key?
    if (!object.name.includes("Key")) {
      return;
    }

    // Get key name only for Tone
    const name = object.name.split("_")[1];
    if (!name) {
      return;
    }

    // Cannot play same key over itself
    if (this.playingKeys.includes(name)) {
      return;
    }

    // Play this key
    this.playingKeys.push(name);
    this.polySynth.triggerAttack(name);
  };

  private onPointerUp = () => {
    // Stop playing keys
    this.playingKeys.forEach((key) => this.polySynth.triggerRelease(key));
    this.playingKeys = [];
  };
}
