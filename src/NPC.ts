import { Billboard, BillboardMode, engine, executeTask, GltfContainer, MeshCollider } from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { AvatarAnchorPointType, AvatarAttach, Transform, AvatarShape } from '@dcl/sdk/ecs'
import { Material, MeshRenderer, InputAction, pointerEventsSystem } from '@dcl/sdk/ecs'
import { getPlayer } from '@dcl/sdk/src/players'
import { onEnterScene, onLeaveScene } from '@dcl/sdk/src/players'
import { triggerSceneEmote, movePlayerTo } from '~system/RestrictedActions'
import { npcComponent } from './components'
import { createTeleportButton } from './teleportButton'
import { createTorus } from './torus'
import { MessageBus } from '@dcl/sdk/message-bus'

// Create a message bus instance
const sceneMessageBus = new MessageBus()

// Define message payload types
type NpcPositionUpdate = {
  npcId: number
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
}

type NpcWearableUpdate = {
  npcId: number
  wearables: string[]
  name: string
  expressionTriggerId?: string
  playerId?: string // Add playerId to sync it across clients
}

type PlayerPresenceUpdate = {
  playerId: string
  isPresent: boolean
}

// Seeded random function for deterministic positions
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export function spawnNPC(count: number) {
  for (let i = 0; i < count; i++) {
    const myAvatar = engine.addEntity()
    const npcId = i + 1000
    const npcNameId = `npc-${npcId}`

    AvatarShape.create(myAvatar, {
      id: npcNameId,
      name: '',
      wearables: ['decentraland:off-chain:base-avatars:BaseMale'],
      emotes: []
    })

    const seed = npcId
    const radius = 15
    const angle = seededRandom(seed) * 2 * Math.PI
    const r = radius * Math.sqrt(seededRandom(seed + 1))
    const x = 16 + r * Math.cos(angle)
    const z = 16 + r * Math.sin(angle)
    const yaw = seededRandom(seed + 2) * 360

    Transform.create(myAvatar, {
      position: Vector3.create(x, 35.4, z),
      rotation: Quaternion.fromEulerDegrees(0, yaw, 0)
    })

    npcComponent.create(myAvatar, { npcId })
  }

  setupMessageBusListeners()
}

function setupMessageBusListeners() {
  sceneMessageBus.on('updateNpcPosition', (info: NpcPositionUpdate) => {
    for (const [entity] of engine.getEntitiesWith(npcComponent)) {
      const npc = npcComponent.get(entity)
      if (npc.npcId === info.npcId) {
        const transform = Transform.getMutable(entity)
        transform.position = { x: info.position.x, y: info.position.y, z: info.position.z }
        transform.rotation = { x: info.rotation.x, y: info.rotation.y, z: info.rotation.z, w: info.rotation.w }
        console.log(`NPC ${npc.npcId} position updated to:`, transform.position)
        break
      }
    }
  })

  sceneMessageBus.on('updateNpcWearables', (info: NpcWearableUpdate) => {
    for (const [entity] of engine.getEntitiesWith(npcComponent)) {
      const npc = npcComponent.get(entity)
      if (npc.npcId === info.npcId) {
        const avatar = AvatarShape.getMutable(entity)
        const npcMutable = npcComponent.getMutable(entity)
        avatar.wearables = info.wearables
        avatar.name = info.name
        if (info.expressionTriggerId) {
          avatar.expressionTriggerId = info.expressionTriggerId
        }
        npcMutable.playerId = info.playerId || 'undefined' // Sync playerId
        console.log(`NPC ${npc.npcId} wearables updated:`, info.wearables, `playerId: ${npcMutable.playerId}`)
        break
      }
    }
  })

  sceneMessageBus.on('playerPresence', (info: PlayerPresenceUpdate) => {
    if (info.isPresent) {
      activePlayers.add(info.playerId)
      console.log(`Player ${info.playerId} added to activePlayers. Current size: ${activePlayers.size}`)
    } else {
      activePlayers.delete(info.playerId)
      console.log(`Player ${info.playerId} removed from activePlayers. Current size: ${activePlayers.size}`)
    }
  })
}

export function updateNpcWearableSystem(dt: number) {
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
      console.log(`NPC ${npc.npcId} is close to player ${currentPlayerId}`)
      npc.playerId = currentPlayerId

      sceneMessageBus.emit('updateNpcWearables', {
        npcId: npc.npcId,
        wearables: userData.wearables,
        name: userData.name,
        expressionTriggerId: 'clap',
        playerId: currentPlayerId // Send playerId to sync it
      })
    }
  }
}

let lastPlayerPos: Vector3 | null = null

export function followPlayerSystem(dt: number) {
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) return

  const playerPos = playerTransform.position
  const radius = 2
  const radiusSquared = radius * radius
  const stepSize = 0.5

  let playerMoved = false
  if (lastPlayerPos) {
    const distanceMovedSquared = Vector3.distanceSquared(playerPos, lastPlayerPos)
    if (distanceMovedSquared > 0.001) {
      playerMoved = true
    }
  }
  lastPlayerPos = Vector3.create(playerPos.x, playerPos.y, playerPos.z)

  for (const [entity] of engine.getEntitiesWith(npcComponent)) {
    const npcTransform = Transform.getMutable(entity)
    const npc = npcComponent.get(entity)
    const npcPos = npcTransform.position

    if (Math.abs(playerPos.x - npcPos.x) > radius || Math.abs(playerPos.z - npcPos.z) > radius) continue
    const distanceSquared = Vector3.distanceSquared(playerPos, npcPos)
    if (distanceSquared <= radiusSquared) {
      const direction = Vector3.subtract(playerPos, npcPos)
      if (Vector3.lengthSquared(direction) > 0) {
        const normalizedDirectionForStep = Vector3.normalize(direction)
        if (playerMoved) {
          const stepVector = Vector3.scale(normalizedDirectionForStep, stepSize)
          npcTransform.position = Vector3.add(npcPos, stepVector)

          sceneMessageBus.emit('updateNpcPosition', {
            npcId: npc.npcId,
            position: {
              x: npcTransform.position.x,
              y: npcTransform.position.y,
              z: npcTransform.position.z
            },
            rotation: {
              x: npcTransform.rotation.x,
              y: npcTransform.rotation.y,
              z: npcTransform.rotation.z,
              w: npcTransform.rotation.w
            }
          })
        }
      }
    }
  }
}

export function lookAtPlayerSystem(dt: number) {
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) return

  const playerPos = playerTransform.position
  const radius = 2
  const radiusSquared = radius * radius

  for (const [entity] of engine.getEntitiesWith(npcComponent)) {
    const npcTransform = Transform.getMutable(entity)
    const npc = npcComponent.get(entity)
    const npcPos = npcTransform.position

    if (Math.abs(playerPos.x - npcPos.x) > radius || Math.abs(playerPos.z - npcPos.z) > radius) continue
    const distanceSquared = Vector3.distanceSquared(playerPos, npcPos)
    if (distanceSquared <= radiusSquared) {
      const direction = Vector3.subtract(playerPos, npcPos)
      if (Vector3.lengthSquared(direction) > 0) {
        direction.y = 0
        const rotationDirection = Vector3.normalize(direction)
        const lookRotation = Quaternion.fromLookAt(Vector3.Zero(), rotationDirection, Vector3.Up())
        npcTransform.rotation = lookRotation

        sceneMessageBus.emit('updateNpcPosition', {
          npcId: npc.npcId,
          position: {
            x: npcTransform.position.x,
            y: npcTransform.position.y,
            z: npcTransform.position.z
          },
          rotation: {
            x: npcTransform.rotation.x,
            y: npcTransform.rotation.y,
            z: npcTransform.rotation.z,
            w: npcTransform.rotation.w
          }
        })
      }
    }
  }
}

// Player presence and NPC reversion
const activePlayers = new Set<string>()
const initialWearable = ['decentraland:off-chain:base-avatars:BaseMale']

export function setupPlayerPresence() {
  const userData = getPlayer()
  if (!userData) return
  const currentPlayerId = userData.userId

  onEnterScene((player) => {
    if (!player?.userId) return
    console.log('Player entered scene:', player.userId)
    sceneMessageBus.emit('playerPresence', { playerId: player.userId, isPresent: true })
    activePlayers.add(player.userId)
  })

  onLeaveScene((userId) => {
    if (!userId) return
    console.log('Player left scene:', userId)
    sceneMessageBus.emit('playerPresence', { playerId: userId, isPresent: false })
    activePlayers.delete(userId)

    // Leader election: only the lowest playerId processes reversion
    let isLeader = true
    for (const playerId of activePlayers) {
      if (playerId < currentPlayerId) {
        isLeader = false
        break
      }
    }

    if (isLeader) {
      console.log(`Leader ${currentPlayerId} resetting NPCs for departed player ${userId}`)
      for (const [entity] of engine.getEntitiesWith(npcComponent)) {
        const npc = npcComponent.getMutable(entity)
        if (npc.playerId === userId) {
          console.log(`Resetting NPC ${npc.npcId} bound to player ${userId}`)
          sceneMessageBus.emit('updateNpcWearables', {
            npcId: npc.npcId,
            wearables: initialWearable,
            name: '',
            expressionTriggerId: 'idle', // wave idle?
            playerId: 'undefined' // Reset playerId to undefined
          })
          npc.playerId = 'undefined'
        }
      }
    }
  })

  // Initial presence broadcast
  sceneMessageBus.emit('playerPresence', { playerId: currentPlayerId, isPresent: true })
  activePlayers.add(currentPlayerId)
  console.log(`Initial activePlayers: ${Array.from(activePlayers)}`)
}
