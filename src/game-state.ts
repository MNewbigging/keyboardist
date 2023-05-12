import * as THREE from "three";
import * as Tone from "tone";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { gsap } from "gsap";

import { GameLoader } from "./loaders/game-loader";
import { addGui } from "./utils/utils";

export class GameState {
  private scene = new THREE.Scene();
  private keyboard?: THREE.Object3D;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer: { x: number; y: number } = { x: 0, y: 0 };
  private polySynth = new Tone.PolySynth().toDestination();
  private pressedKeys: string[] = [];
  private pressedButtons = new Set<string>();
  private restPositions = new Map<string, number>();
  private powerOn = false;

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
    this.keyboard = this.gameLoader.modelLoader.get("keyboard");
    if (this.keyboard) {
      // Set the original key positions for animating to/from on press
      [
        "C3",
        "C#3",
        "D3",
        "D#3",
        "E3",
        "F3",
        "F#3",
        "G3",
        "G#3",
        "A3",
        "A#3",
        "B3",
        "C4",
        "C#4",
        "D4",
        "D#4",
        "E4",
        "F4",
        "F#4",
        "G4",
        "G#4",
        "A4",
        "A#4",
        "B4",
        "C5",
      ].forEach((key) => {
        const object = this.keyboard?.getObjectByName(`Key_${key}`);
        if (object) {
          this.restPositions.set(key, object.position.y);
        }
      });

      const powerButton = this.keyboard.getObjectByName("powerButton");
      if (powerButton) {
        this.restPositions.set("powerButton", powerButton.position.y);
      }

      this.scene.add(this.keyboard);
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

    switch (object.name) {
      case "powerButton":
        this.pressPowerButton(object);
        break;
      default: {
        // Was it a key?
        if (object.name.includes("Key")) {
          this.pressKey(object);
        }
      }
    }
  };

  private pressPowerButton(button: THREE.Object3D) {
    // Can only be pressing once
    if (this.pressedButtons.has(button.name)) {
      return;
    }

    this.powerOn = !this.powerOn;
    this.pressedButtons.add(button.name);

    // Animate press
    const restPosition = this.restPositions.get(button.name);
    if (restPosition) {
      const pressedPosition = restPosition - 0.002;

      const pressTimeline = gsap.timeline();
      pressTimeline.to(button.position, { duration: 0.2, y: pressedPosition });
      pressTimeline.to(button.position, {
        duration: 0.2,
        y: restPosition,
        delay: 0.1,
        onComplete: () => {
          this.pressedButtons.delete(button.name);
        },
      });

      pressTimeline.play();
    }

    // Change material colour
    const led =
      this.keyboard?.getObjectByName("powerButtonHousing")?.children[1];
    if (led) {
      const mesh = led as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial;

      const color = this.powerOn ? "green" : "red";
      material.color.setColorName(color);
      material.emissive.setColorName(color);
    }
  }

  private pressKey(object: THREE.Object3D) {
    // Get key name only for Tone
    const name = object.name.split("_")[1];
    if (!name) {
      return;
    }

    // Cannot play same key over itself
    if (this.pressedKeys.includes(name)) {
      return;
    }

    this.pressedKeys.push(name);

    // Animate key press
    const restPosition = this.restPositions.get(name);
    if (restPosition !== undefined) {
      const pressAmount = name.includes("#") ? 0.005 : 0.01;

      const pressedPosition = restPosition - pressAmount;
      gsap.to(object.position, { duration: 0.3, y: pressedPosition });
    }

    // Sound the key - if the power is on!
    if (this.powerOn) {
      this.polySynth.triggerAttack(name);
    }
  }

  private onPointerUp = () => {
    // Stop playing keys
    this.pressedKeys.forEach((key) => {
      this.polySynth.triggerRelease(key);

      const object = this.keyboard?.getObjectByName(`Key_${key}`);
      const restPosition = this.restPositions.get(key);
      if (object && restPosition !== undefined) {
        gsap.to(object.position, {
          duration: 0.3,
          y: restPosition,
        });
      }
    });
    this.pressedKeys = [];
  };
}
