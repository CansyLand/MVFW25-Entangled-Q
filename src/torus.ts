import { Billboard, BillboardMode, engine, executeTask, GltfContainer, MeshCollider } from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { Transform } from '@dcl/sdk/ecs'

export function createTorus() {
  const torusEntity = engine.addEntity()

  Transform.create(torusEntity, {
    position: Vector3.create(16, 0, 16),
    rotation: Quaternion.fromEulerDegrees(0, 0, 0),
    scale: Vector3.create(1, 1, 1)
  })

  // Add the GLTF model (converted from STL) to the entity
  GltfContainer.create(torusEntity, {
    src: 'models/01_torus.glb' // Path to your converted .glb file
  })
}
