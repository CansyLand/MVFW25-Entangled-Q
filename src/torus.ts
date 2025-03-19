import {
  Billboard,
  BillboardMode,
  engine,
  executeTask,
  GltfContainer,
  MeshCollider,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Transform, Entity } from '@dcl/sdk/ecs'

// Create entities
const torusEntityInsideOne = engine.addEntity()
const torusEntityInsideTwo = engine.addEntity()
const torusEntityInsideThree = engine.addEntity()

const torusAnimationArray: Entity[] = [torusEntityInsideOne, torusEntityInsideTwo, torusEntityInsideThree]
let torusAnimationIndex = 0
let lastFrameTime = 0
const FRAME_DURATION = 1 // Adjust this value to change animation speed (in seconds)

export function createTorus() {
  const torusEntity = engine.addEntity()

  Transform.create(torusEntity, {
    position: Vector3.create(16, 0, 16),
    rotation: Quaternion.fromEulerDegrees(0, 0, 0),
    scale: Vector3.create(1, 1, 1)
  })

  GltfContainer.create(torusEntity, {
    src: 'models/03_torus_02.glb'
  })

  // Inside torus setup
  // Transform.create(torusEntityInsideOne, {
  //   position: Vector3.create(16, 0, 16),
  //   rotation: Quaternion.fromEulerDegrees(0, 0, 0),
  //   scale: Vector3.create(1, 1, 1)
  // })

  // GltfContainer.create(torusEntityInsideOne, {
  //   src: 'models/03_torus_01.glb'
  // })

  // Transform.create(torusEntityInsideTwo, {
  //   position: Vector3.create(16, 0, 16),
  //   rotation: Quaternion.fromEulerDegrees(0, 0, 0),
  //   scale: Vector3.create(1, 1, 1)
  // })

  // GltfContainer.create(torusEntityInsideTwo, {
  //   src: 'models/02_torus_inside_02.glb'
  // })

  // Transform.create(torusEntityInsideThree, {
  //   position: Vector3.create(16, 0, 16),
  //   rotation: Quaternion.fromEulerDegrees(0, 0, 0),
  //   scale: Vector3.create(1, 1, 1)
  // })

  // GltfContainer.create(torusEntityInsideThree, {
  //   src: 'models/02_torus_inside_03.glb'
  // })

  // Set initial visibility
  VisibilityComponent.create(torusEntityInsideOne, { visible: true })
  VisibilityComponent.create(torusEntityInsideTwo, { visible: false })
  VisibilityComponent.create(torusEntityInsideThree, { visible: false })

  // Add the animation system
  // engine.addSystem(animateTorusSystem)
}

function animateTorusSystem(dt: number) {
  // Accumulate time
  lastFrameTime += dt

  // Check if it's time to switch frames
  if (lastFrameTime >= FRAME_DURATION) {
    // Hide current torus
    VisibilityComponent.createOrReplace(torusAnimationArray[torusAnimationIndex], { visible: false })

    // Move to next torus
    torusAnimationIndex = (torusAnimationIndex + 1) % torusAnimationArray.length

    // Show next torus
    VisibilityComponent.createOrReplace(torusAnimationArray[torusAnimationIndex], { visible: true })

    // Reset timer
    lastFrameTime = 0
  }
}
