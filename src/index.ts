import { Billboard, BillboardMode, engine, executeTask, GltfContainer, MeshCollider } from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { AvatarAnchorPointType, AvatarAttach, Transform, AvatarShape } from '@dcl/sdk/ecs'
import { Material } from '@dcl/sdk/ecs'
import { MeshRenderer } from '@dcl/sdk/ecs'
import { InputAction, pointerEventsSystem } from '@dcl/sdk/ecs'
import { getPlayer } from '@dcl/sdk/src/players'
import { triggerSceneEmote, movePlayerTo } from '~system/RestrictedActions'
import { npcComponent } from './components'
import { createTeleportButton } from './teleportButton'
import { createTorus } from './torus'
import { mirrorAvatar, spawnNPC, updateNpcSystem } from './NPC'

// 🔴 reduce NPC count via server!
// 🔴 Name server toggle

/* 
- NPC is neutral
- Payer walks by NPC
- NPC updated wearables
- NPC looks at you 
- NPC applouds
- if someone leaves scene avatart turns neutal
- one after anoter



*/

export function main() {
  createTorus()
  createTeleportButton()
  spawnNPC(1000)
}

// engine.addSystem(mirrorAvatar, 0, 'mirrorAvatarSystem')
engine.addSystem(updateNpcSystem, 0, 'updateNpcSystem')

// System to handle NPC behavior
function npcSystem(dt: number) {
  for (const [entity] of engine.getEntitiesWith(npcComponent)) {
    // Access other components of the entity if needed

    // let userData = getPlayer()
    // if (!userData) return
    Transform.getMutable(entity).rotation = Quaternion.add(
      Quaternion.fromEulerDegrees(0, dt, dt),
      Transform.get(entity).rotation
    )

    Transform.getMutable(entity).position = Vector3.create(
      Math.random() * 14 + 1, // Random X coordinate between 0 and 16
      0.25, // Y coordinate remains the same
      Math.random() * 14 + 1 // Random Z coordinate between 0 and 16
    )

    // Add your logic here for each NPC
  }
}

// Add the system to the engine
// engine.addSystem(npcSystem)
