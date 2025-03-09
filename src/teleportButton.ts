import { engine, MeshCollider } from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Transform } from '@dcl/sdk/ecs'
import { Material } from '@dcl/sdk/ecs'
import { MeshRenderer } from '@dcl/sdk/ecs'
import { InputAction, pointerEventsSystem } from '@dcl/sdk/ecs'
import { movePlayerTo } from '~system/RestrictedActions'

export function createTeleportButton() {
  const teleportCube = engine.addEntity()

  // Add transform to position the cube
  Transform.create(teleportCube, {
    position: Vector3.create(8, 1, 8), // Position it somewhere accessible
    scale: Vector3.create(1, 1, 1),
    rotation: Quaternion.fromEulerDegrees(0, 0, 0)
  })

  // Make it a cube
  MeshRenderer.setBox(teleportCube)
  MeshCollider.setBox(teleportCube)

  // Add material to make it visible
  Material.setPbrMaterial(teleportCube, {
    albedoColor: Color4.Red(), // Make it red so it's noticeable
    roughness: 0.5,
    metallic: 0.5
  })

  // Add click interaction using movePlayerTo
  pointerEventsSystem.onPointerDown(
    {
      entity: teleportCube,
      opts: {
        button: InputAction.IA_POINTER,
        hoverText: 'Teleport Up'
      }
    },
    () => {
      console.log('Teleport cube clicked!') // Confirm click is registered

      // Teleport player to y = 40, keeping x and z the same (relative to scene base)
      movePlayerTo({
        newRelativePosition: Vector3.create(8, 40, 8), // Teleport to center of scene at y=40
        cameraTarget: Vector3.create(8, 40, 8) // Optional: Camera looks at same point
        // avatarTarget: Vector3.create(8, 1, 8)        // Optional: Avatar faces downward (uncomment if desired)
      })
        .then(() => {
          console.log('Teleport successful!')
        })
        .catch((error) => {
          console.error('Teleport failed:', error)
        })
    }
  )
}
