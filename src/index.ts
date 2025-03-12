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
import { followPlayerSystem, lookAtPlayerSystem, setupPlayerPresence, spawnNPC, updateNpcWearableSystem } from './NPC'
import { createSyncButton } from './syncButton'
import { isStateSyncronized, syncEntity } from '@dcl/sdk/network'

/* 
✓ NPC is neutral
✓ Payer walks by NPC
✓ NPC updated wearables
✓ NPC looks at you 
✓ NPC applouds
✓ Sync NPCs with otehr players
✓ if someone leaves scene avatart turns neutal
- one after anoter
- new player should get newest NPC state

– 3D environment Blender 23? textures?
- Flor desing
- teleporter design
- Space design

– Music? Jukebox?
// 🔴 reduce NPC count via server!
// 🔴 Name server toggle
- FPS NPC controller
// Stram music from parutkin server + fallback



// decentraland://realm=http://127.0.0.1:8000&local-scene=true&debug=true

*/

export function main() {
  spawnNPC(10)
  createTorus()
  createTeleportButton()
  //createSyncButton()

  setupPlayerPresence()
  engine.addSystem(updateNpcWearableSystem)
  // engine.addSystem(followPlayerSystem)
  engine.addSystem(lookAtPlayerSystem)
  // engine.addSystem(revertNpcWearablesSystem)
}
