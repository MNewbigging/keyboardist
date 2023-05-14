import * as THREE from "three";
import * as Tone from "tone";
import { gsap } from "gsap";

export class KeyboardManager {
  // Keyboard state
  private pressedKeys: string[] = [];
  private pressedButtons = new Set<string>();
  private restPositions = new Map<string, number>();
  private powerOn = false;

  // Audio stuff
  private polySynth = new Tone.PolySynth().toDestination();

  constructor(private keyboard: THREE.Object3D) {
    this.setup();
  }

  onIntersectObject(object: THREE.Object3D) {
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
  }

  resetKeys() {
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
  }

  private setup() {
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
      const object = this.keyboard.getObjectByName(`Key_${key}`);
      if (object) {
        this.restPositions.set(key, object.position.y);
      }
    });

    const powerButton = this.keyboard.getObjectByName("powerButton");
    if (powerButton) {
      this.restPositions.set("powerButton", powerButton.position.y);
    }
  }

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
}
