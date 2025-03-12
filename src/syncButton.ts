import { engine, MeshCollider, Entity } from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Transform, Material, MeshRenderer, InputAction, pointerEventsSystem } from '@dcl/sdk/ecs'
import { MessageBus } from '@dcl/sdk/message-bus'

// Create a message bus instance
const sceneMessageBus = new MessageBus()

// Define a type for the position message payload
type CubePosition = {
  position: { x: number; y: number; z: number }
}

export function createSyncButton() {
  // Create the testCube (the one that moves)
  const testCube = engine.addEntity()
  Transform.create(testCube, {
    position: Vector3.create(6, 1, 8) // Initial position
  })
  MeshRenderer.setBox(testCube)

  // Create the syncCube (the clickable trigger)
  const syncCube = engine.addEntity()
  Transform.create(syncCube, {
    position: Vector3.create(6.1, 1, 8), // Position it somewhere accessible
    scale: Vector3.create(1, 1, 1),
    rotation: Quaternion.fromEulerDegrees(0, 0, 0)
  })
  MeshRenderer.setBox(syncCube)
  MeshCollider.setBox(syncCube)
  Material.setPbrMaterial(syncCube, {
    albedoColor: Color4.Red(), // Make it red so it's noticeable
    roughness: 0.5,
    metallic: 0.5
  })

  // Add click interaction to send a message
  pointerEventsSystem.onPointerDown(
    {
      entity: syncCube,
      opts: {
        button: InputAction.IA_POINTER,
        hoverText: 'SYNC'
      }
    },
    () => {
      // Define the new position (moving to absolute 2, 2, 2 as in your original)
      const newPosition = Vector3.add(Vector3.create(1, 1, 1), Vector3.create(1, 1, 1))
      console.log('Sending position update:', newPosition)

      // Emit the new position via MessageBus
      sceneMessageBus.emit('moveTestCube', {
        position: { x: newPosition.x, y: newPosition.y, z: newPosition.z }
      })
    }
  )

  // Listen for the 'moveTestCube' message and update testCube's position
  sceneMessageBus.on('moveTestCube', (info: CubePosition) => {
    console.log('Received position update:', info.position)
    Transform.getMutable(testCube).position = {
      x: info.position.x,
      y: info.position.y,
      z: info.position.z
    }
  })
}
