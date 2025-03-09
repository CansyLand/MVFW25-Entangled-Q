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

export function spawnNPC(count: number) {
  for (let i = 0; i < count; i++) {
    const myAvatar = engine.addEntity()
    const npcID = `npc-${i}`
    AvatarShape.create(myAvatar, {
      id: npcID,
      name: '',
      wearables: ['decentraland:off-chain:base-avatars:BaseMale'],
      emotes: []
    })
    // Generate random position within a circle of diameter 32
    const radius = 15 // Radius is half of the diameter
    const angle = Math.random() * 2 * Math.PI
    const r = radius * Math.sqrt(Math.random())
    const x = 16 + r * Math.cos(angle)
    const z = 16 + r * Math.sin(angle)

    Transform.create(myAvatar, {
      position: Vector3.create(
        x, // Random X coordinate within the circle
        35.4, // Y coordinate remains the same
        z // Random Z coordinate within the circle
      )
    })
    npcComponent.create(myAvatar)
  }
}

export function updateNpcSystem(dt: number) {
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) return

  const userData = getPlayer()
  if (!userData) return
  const currentPlayerId = userData.userId

  const playerPos = playerTransform.position
  const radius = 1
  const radiusSquared = radius * radius

  for (const [entity] of engine.getEntitiesWith(npcComponent)) {
    const npc = npcComponent.getMutable(entity)
    if (npc.playerId && npc.playerId === currentPlayerId) continue

    const npcPos = Transform.get(entity).position
    if (Math.abs(playerPos.x - npcPos.x) > radius || Math.abs(playerPos.z - npcPos.z) > radius) continue
    const distanceSquared = Vector3.distanceSquared(playerPos, npcPos)
    if (distanceSquared <= radiusSquared) {
      console.log('NPC' + npc.playerId + ' is close to player' + currentPlayerId)
      npc.playerId = currentPlayerId
      console.log('NPC' + npc.playerId + ' is close to player' + currentPlayerId)
      const mutableAvatar = AvatarShape.getMutable(entity)
      mutableAvatar.wearables = userData.wearables
      mutableAvatar.name = userData.name
    }
  }
}

export function mirrorAvatar(dt: number) {
  let userData = getPlayer()
  console.log(userData)
  if (!userData) return

  for (let i = 0; i < 100; i++) {
    const myAvatar = engine.addEntity()
    //AvatarShape.create(myAvatar)

    // https://docs.decentraland.org/creator/development-guide/sdk7/npc-avatars/
    AvatarShape.create(myAvatar, {
      id: 'my-npc', // Required: unique identifier (example using timestamp)
      name: '', // Name to display
      wearables: [
        // 'urn:decentraland:matic:collections-v2:0x1f680e46d6b13ec54117ca12fbea92128374a495:0', // Skirt Boots
        // 'urn:decentraland:matic:collections-v2:0x2d9560df9dd8ba8b2dc3746bc1d217698d258fb5:0' // Nude
        // 'decentraland:off-chain:base-avatars:BaseMale' // Neutral Ghost
        // 'urn:decentraland:matic:collections-v2:0x768c1027b1f1a452ecb8dab017a1e630a75f0d30:2' // Suit
        'urn:decentraland:matic:collections-v2:0x768c1027b1f1a452ecb8dab017a1e630a75f0d30:0' // Goth Girl
        // 'urn:decentraland:matic:collections-v2:0x768c1027b1F1A452ECB8Dab017a1E630a75f0D30:1310' // Nude
        // 'urn:decentraland:off-chain:base-avatars:BaseMale'
      ], // Default empty array for wearables
      emotes: [] // Default empty array for emotes
    })

    Transform.create(myAvatar, {
      position: Vector3.create(
        Math.random() * 32, // Random X coordinate between 0 and 16
        35.4, // Y coordinate remains the same
        Math.random() * 32 // Random Z coordinate between 0 and 16
      )
    })

    npcComponent.create(myAvatar)

    // Billboard.create(myAvatar, {
    //   billboardMode: BillboardMode.BM_Y
    // })

    if (userData?.wearables) {
      const mutableAvatar = AvatarShape.getMutable(myAvatar)

      //   mutableAvatar.wearables = userData.wearables
      //   mutableAvatar.bodyShape = userData.avatar?.bodyShapeUrn
      //   mutableAvatar.eyeColor = userData.avatar?.eyesColor
      //   mutableAvatar.skinColor = userData.avatar?.skinColor
      //   mutableAvatar.hairColor = userData.avatar?.hairColor
      //   // mutableAvatar.expressionTriggerId = 'robot'
      //   mutableAvatar.expressionTriggerId = 'clap'
      //   mutableAvatar.emotes = ['emote/Meditation_Emote.glb']

      //   triggerSceneEmote({ src: 'emote/Meditation_Emote.glb', loop: false })
      //mutableAvatar.expressionTriggerId = 'dance'
    }
  }

  if (userData) {
    engine.removeSystem('mirrorAvatarSystem')
  }
}
