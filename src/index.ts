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
import {
  wearableBodyCheckSystem,
  followPlayerSystem,
  lookAtPlayerSystem,
  setupPlayerPresence,
  spawnNPC,
  updateNpcWearableSystem
} from './NPC'
import { createSyncButton } from './syncButton'
import { isStateSyncronized, syncEntity } from '@dcl/sdk/network'

/* 
✓ NPC is neutral
✓ Payer walks by NPC
✓ NPC updated wearables
✓ NPC looks at you 
✓ NPC applouds
✓ Sync NPCs with otehr players
- if someone leaves scene avatart turns neutal WEARABLE neutral variable
- one after anoter
- sync?
✓ new player should get newest NPC state
- chqnge of wearable shoudl reflect in NPCs

- MWVF25 GitHub

– 3D environment Blender 23? textures?
- Flor desing
- teleporter design
- Space design

– Music? Jukebox?
// 🔴 reduce NPC count via server!
// 🔴 Name server toggle
- FPS NPC controller
// Stram music from parutkin server + fallback

– Clean up code (imports)


  Open local scene in DCL explorer
  decentraland://realm=http://127.0.0.1:8000&local-scene=true&debug=true

  Publish to world
  npm run deploy -- --target-content https://worlds-content-server.decentraland.org
  https://docs.decentraland.org/creator/worlds/about/

*/

export function main() {
  createTorus()
  createTeleportButton(setupNPCs)

  // engine.addSystem(followPlayerSystem)
  // engine.addSystem(revertNpcWearablesSystem)
  //createSyncButton()
}

function setupNPCs() {
  spawnNPC(100)
  setupPlayerPresence()
  engine.addSystem(updateNpcWearableSystem)
  engine.addSystem(lookAtPlayerSystem)
  engine.addSystem(wearableBodyCheckSystem)
}

// coordinates -26,-124 -25,-124 -26,-125 -25,-125
// origin point -26,-125

// https://decentraland.org/marketplace/contracts/0xd05723401566e9d9b7a728bd4dbe07584cf8ac76/items/1 - alien
// https://decentraland.org/marketplace/contracts/0xb9397d2916f4857f16c79e9cd79f44149f0d0008/items/0 - Nasca Alien
// https://decentraland.org/marketplace/contracts/0xed2e8fa6afe1bd743e17b46eadce69916e32a94e/items/0 - invisible suit
// https://decentraland.org/marketplace/contracts/0xadb8440505f2d801b60f8a2d226a2b3658a3e4aa/items/0 - empty void
// https://decentraland.org/marketplace/contracts/0xdc26c8d769387a870a06d4f3b1b595d09877b70c/items/0 - misuc neon worm
// https://decentraland.org/marketplace/contracts/0xff8e630bd43246bf5c37aecc0228af5418a8ceef/items/5 - david
// https://decentraland.org/marketplace/contracts/0xff8e630bd43246bf5c37aecc0228af5418a8ceef/items/6 - venus
// https://decentraland.org/marketplace/contracts/0xb4e7fa1ae09529acfcc17ace588865f43027fd1c/items/2 - noir gleam
// https://decentraland.org/marketplace/contracts/0x93dcafee005a023b9fe5b34b71ab696bea4d665e/items/0 - hologram
// https://decentraland.org/marketplace/contracts/0x2577389b86e41f9728faf40654cc0675169dc042/items/0 - fish man
// https://decentraland.org/marketplace/contracts/0x430c1d71b97d530669c8ab2e3a8a45ec4248862f/items/0 - energy
// https://decentraland.org/marketplace/contracts/0x253dc2bf5817f7043bc1f6a5bf85e805ec108df4/items/0 - shadow person
// https://decentraland.org/marketplace/contracts/0x9ba49dd0292c69cdf4819107099537e08165be6b/items/0 - Jellyfish
// https://decentraland.org/marketplace/contracts/0x7a2a7f25f2e2fe688babe63aef103b4490748c02/items/0 - Lemon Man

// https://decentraland.org/marketplace/contracts/0xd96b73293f278d1d5ee440a2fd859679170dbbdb/items/0 - Glow Mask
// https://decentraland.org/marketplace/contracts/0x4d76dd496c95e1a75f7f9d48a1debafbfa8e5c4e/items/0 - Glow Shirt
// https://decentraland.org/marketplace/contracts/0x61ce6d94caceaee27f694d3798a370fd2bfde7c4/items/0 - Glow Pants
// https://decentraland.org/marketplace/contracts/0x085e4efed4ff7dce97fadce8d0b6a4c73a4709f3/items/0 - Glow Shoes
// https://decentraland.org/marketplace/contracts/0xc2f737293a3b6da7c75ececc095265e76dc3f799/items/0 - Glow Gloves

// https://decentraland.org/marketplace/contracts/0x9c66321b8d4a40ffd8103a466fd2dfacb98ff1dc/items/0 - Caustic bodypaint
