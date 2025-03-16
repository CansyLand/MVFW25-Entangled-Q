import { Billboard, BillboardMode, engine, executeTask, GltfContainer, MeshCollider } from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion, Color3 } from '@dcl/sdk/math'
import {
  AvatarAnchorPointType,
  AvatarAttach,
  Transform,
  AvatarShape,
  AvatarEquippedData,
  AvatarBase
} from '@dcl/sdk/ecs'
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
type NpcWearableUpdate = {
  npcId: number
  wearables: string[]
  name: string
  expressionTriggerId?: string
  playerId: string // Always included for reference
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
}

type PlayerJoinBroadcast = {
  playerId: string
  joinTimestamp: number
}

type NpcStateUpdate = {
  targetPlayerId: string
  npcStates: Array<{
    npcId: number
    wearables: string[]
    name: string
    position: { x: number; y: number; z: number }
    playerId: string
  }>
}

type NpcResetBroadcast = {
  departedPlayerId: string
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
      wearables: ['urn:decentraland:matic:collections-v2:0xff8e630bd43246bf5c37aecc0228af5418a8ceef:5'],
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
  // setUpWearablesChangeListener()
}

function setupMessageBusListeners() {
  sceneMessageBus.on('updateNpcWearables', (info: NpcWearableUpdate) => {
    for (const [entity] of engine.getEntitiesWith(npcComponent)) {
      const npc = npcComponent.get(entity)
      if (npc.npcId === info.npcId) {
        const avatar = AvatarShape.getMutable(entity)
        const npcMutable = npcComponent.getMutable(entity)
        const transform = Transform.getMutable(entity)
        avatar.wearables = info.wearables
        avatar.name = info.name
        avatar.expressionTriggerId = info.expressionTriggerId || 'idle'
        npcMutable.playerId = info.playerId
        transform.position = info.position
        transform.rotation = info.rotation
        console.log(`Updated NPC ${npc.npcId} for player ${info.playerId}`)
        break
      }
    }
  })

  sceneMessageBus.on('playerJoinBroadcast', (info: PlayerJoinBroadcast) => {
    activePlayers.set(info.playerId, info.joinTimestamp)
    console.log(`Player ${info.playerId} joined at ${info.joinTimestamp}, activePlayers: ${mapToString(activePlayers)}`)

    const oldestTimestamp = Math.min(...Array.from(activePlayers.values()))
    if (activePlayers.get(currentPlayerId) === oldestTimestamp) {
      console.log(`Oldest player ${currentPlayerId} sending NPC state to ${info.playerId}`)
      sendNpcStateToNewPlayer(info.playerId)
    }
  })

  sceneMessageBus.on('npcStateUpdate', (info: NpcStateUpdate) => {
    if (info.targetPlayerId === currentPlayerId) {
      console.log(`Received NPC state update for ${currentPlayerId}`)
      updateNpcStates(info.npcStates)
    } else {
      console.log(`Ignoring NPC state update for ${info.targetPlayerId}`)
    }
  })

  sceneMessageBus.on('npcResetBroadcast', (info: NpcResetBroadcast) => {
    console.log(`Received reset command for departed player ${info.departedPlayerId}`)
    resetNpcsForPlayer(info.departedPlayerId)
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

      const transform = Transform.get(entity)
      sceneMessageBus.emit('updateNpcWearables', {
        npcId: npc.npcId,
        wearables: userData.wearables,
        name: userData.name,
        expressionTriggerId: 'clap',
        playerId: currentPlayerId,
        position: transform.position,
        rotation: transform.rotation
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
    const npc = npcComponent.getMutable(entity)
    const npcPos = npcTransform.position

    const distanceSquared = Vector3.distanceSquared(playerPos, npcPos)
    const wasInfluenced = npc.isInfluenced
    const isNowInfluenced = distanceSquared <= radiusSquared

    // Check if influence state changed
    if (isNowInfluenced && !wasInfluenced) {
      // Player entered influence radius
      npc.isInfluenced = true
      const avatar = AvatarShape.get(entity)
      sceneMessageBus.emit('updateNpcWearables', {
        npcId: npc.npcId,
        wearables: avatar.wearables,
        name: avatar.name,
        expressionTriggerId: avatar.expressionTriggerId,
        playerId: npc.playerId || 'undefined',
        position: npcTransform.position,
        rotation: npcTransform.rotation
      })
      console.log(`NPC ${npc.npcId} entered influence of player ${npc.playerId}`)
    } else if (!isNowInfluenced && wasInfluenced) {
      // Player left influence radius
      npc.isInfluenced = false
      const avatar = AvatarShape.get(entity)
      sceneMessageBus.emit('updateNpcWearables', {
        npcId: npc.npcId,
        wearables: avatar.wearables,
        name: avatar.name,
        expressionTriggerId: 'idle', // Reset to idle when leaving
        playerId: npc.playerId || 'undefined',
        position: npcTransform.position,
        rotation: npcTransform.rotation
      })
      console.log(`NPC ${npc.npcId} left influence of player ${npc.playerId}`)
    }

    // Continue movement logic only if within radius
    if (isNowInfluenced && playerMoved) {
      const direction = Vector3.subtract(playerPos, npcPos)
      if (Vector3.lengthSquared(direction) > 0) {
        const normalizedDirectionForStep = Vector3.normalize(direction)
        const stepVector = Vector3.scale(normalizedDirectionForStep, stepSize)
        npcTransform.position = Vector3.add(npcPos, stepVector)
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
    const npc = npcComponent.getMutable(entity)
    const npcPos = npcTransform.position

    const distanceSquared = Vector3.distanceSquared(playerPos, npcPos)
    const wasInfluenced = npc.isInfluenced
    const isNowInfluenced = distanceSquared <= radiusSquared

    // No need to emit update here; followPlayerSystem handles entry/exit
    if (isNowInfluenced) {
      const direction = Vector3.subtract(playerPos, npcPos)
      if (Vector3.lengthSquared(direction) > 0) {
        direction.y = 0
        const rotationDirection = Vector3.normalize(direction)
        const lookRotation = Quaternion.fromLookAt(Vector3.Zero(), rotationDirection, Vector3.Up())
        npcTransform.rotation = lookRotation
      }
    }
  }
}

// Track active players
const activePlayers = new Map<string, number>() // playerId -> joinTimestamp
const initialWearable = ['decentraland:off-chain:base-avatars:BaseMale']
let currentPlayerId: string

export function setupPlayerPresence() {
  const userData = getPlayer()
  if (!userData) return
  currentPlayerId = userData.userId
  const currentJoinTimestamp = Date.now()

  // Add current player to the map
  activePlayers.set(currentPlayerId, currentJoinTimestamp)
  console.log(
    `Player ${currentPlayerId} joined at ${currentJoinTimestamp}, activePlayers: ${mapToString(activePlayers)}`
  )

  // Set up avatar change listeners
  AvatarEquippedData.onChange(engine.PlayerEntity, (equipped) => {
    if (!equipped) return
    const player = getPlayer()
    if (!player) return
    const playerId = player.userId
    console.log(`Player ${playerId} changed wearables: ${equipped.wearableUrns}, emotes: ${equipped.emoteUrns}`)

    // Update NPCs entangled with this player
    for (const [entity] of engine.getEntitiesWith(npcComponent)) {
      const npc = npcComponent.get(entity)
      if (npc.playerId === playerId) {
        const avatar = AvatarShape.get(entity)
        const transform = Transform.get(entity)
        sceneMessageBus.emit('updateNpcWearables', {
          npcId: npc.npcId,
          wearables: equipped.wearableUrns,
          name: avatar.name,
          expressionTriggerId: avatar.expressionTriggerId,
          playerId: playerId,
          position: transform.position,
          rotation: transform.rotation
        })
        console.log(`Broadcasted update for NPC ${npc.npcId} due to wearable change by ${playerId}`)
      }
    }
  })

  AvatarBase.onChange(engine.PlayerEntity, (body) => {
    if (!body) return
    const player = getPlayer()
    if (!player) return
    const playerId = player.userId
    console.log(
      `Player ${playerId} changed base avatar - eyes: ${body.eyesColor}, skin: ${body.skinColor}, hair: ${body.hairColor}, body: ${body.bodyShapeUrn}`
    )

    // Update NPCs entangled with this player (only name might change here)
    for (const [entity] of engine.getEntitiesWith(npcComponent)) {
      const npc = npcComponent.get(entity)
      if (npc.playerId === playerId) {
        const avatar = AvatarShape.get(entity)
        const transform = Transform.get(entity)
        sceneMessageBus.emit('updateNpcWearables', {
          npcId: npc.npcId,
          wearables: avatar.wearables, // Keep existing wearables
          name: player.name, // Update name from player data
          expressionTriggerId: avatar.expressionTriggerId,
          playerId: playerId,
          position: transform.position,
          rotation: transform.rotation
        })
        console.log(`Broadcasted update for NPC ${npc.npcId} due to base avatar change by ${playerId}`)
      }
    }
  })

  // Handle player entering the scene
  onEnterScene((player) => {
    if (!player?.userId) return
    console.log(`Player entered scene: ${player.userId}`)

    // Only the newest player broadcasts their join
    if (player.userId === currentPlayerId) {
      sceneMessageBus.emit('playerJoinBroadcast', {
        playerId: currentPlayerId,
        joinTimestamp: currentJoinTimestamp
      })
      console.log(`Broadcasted join for ${currentPlayerId}`)
    }
  })

  // Handle player leaving the scene (triggers for all players)
  onLeaveScene((userId) => {
    if (!userId) return
    console.log(`Player ${userId} left scene, activePlayers before: ${mapToString(activePlayers)}`)

    // Remove the departed player from activePlayers
    activePlayers.delete(userId)

    // Oldest player broadcasts the reset command
    const oldestTimestamp = activePlayers.size > 0 ? Math.min(...Array.from(activePlayers.values())) : Infinity
    if (activePlayers.get(currentPlayerId) === oldestTimestamp && activePlayers.size > 0) {
      console.log(`Oldest player ${currentPlayerId} broadcasting NPC reset for ${userId}`)
      sceneMessageBus.emit('npcResetBroadcast', {
        departedPlayerId: userId
      })
      resetNpcsForPlayer(userId) // Leader also resets locally
    }
  })
}

// Send NPC state to the newest player
function sendNpcStateToNewPlayer(targetPlayerId: string) {
  const npcStates: NpcStateUpdate['npcStates'] = []
  for (const [entity] of engine.getEntitiesWith(npcComponent)) {
    const npc = npcComponent.get(entity)
    const avatar = AvatarShape.get(entity)
    const transform = Transform.get(entity)
    npcStates.push({
      npcId: npc.npcId,
      wearables: avatar.wearables,
      name: avatar.name || '',
      position: transform.position,
      playerId: npc.playerId || 'undefined'
    })
  }
  sceneMessageBus.emit('npcStateUpdate', {
    targetPlayerId,
    npcStates
  })
  console.log(`Sent NPC state to ${targetPlayerId}`)
}

// Update local NPC states (for new players)
function updateNpcStates(npcStates: NpcStateUpdate['npcStates']) {
  for (const state of npcStates) {
    for (const [entity] of engine.getEntitiesWith(npcComponent)) {
      const npc = npcComponent.getMutable(entity)
      if (npc.npcId === state.npcId) {
        const avatar = AvatarShape.getMutable(entity)
        const transform = Transform.getMutable(entity)
        avatar.wearables = state.wearables
        avatar.name = state.name
        transform.position = state.position
        npc.playerId = state.playerId
        console.log(`Updated NPC ${npc.npcId} with playerId ${state.playerId}`)
        break
      }
    }
  }
}

// Reset NPCs for a departed player
function resetNpcsForPlayer(departedPlayerId: string) {
  for (const [entity] of engine.getEntitiesWith(npcComponent)) {
    const npc = npcComponent.getMutable(entity)
    if (npc.playerId === departedPlayerId) {
      const avatar = AvatarShape.getMutable(entity)
      avatar.wearables = initialWearable
      avatar.expressionTriggerId = 'idle'
      avatar.name = ''
      npc.playerId = 'undefined'
      console.log(`Reset NPC ${npc.npcId} for departed player ${departedPlayerId}`)
    }
  }
}

// Helper for logging
function mapToString(map: Map<string, number>): string {
  return JSON.stringify(Array.from(map.entries()))
}

// function setUpWearablesChangeListener() {
//   // Does not work (But keep this function here for reference)
//   AvatarEquippedData.onChange(engine.PlayerEntity, (equipped) => {
//     console.log('Wearable onChange')
//     if (!equipped) return
//     console.log('New wearables list: ', equipped.wearableUrns)
//     console.log('New emotes list : ', equipped.emoteUrns)
//   })
//   AvatarBase.onChange(engine.PlayerEntity, (body) => {
//     console.log('Base avatar onChange ')
//     if (!body) return
//     console.log('New eyes color: ', body.eyesColor)
//     console.log('New skin color: ', body.skinColor)
//     console.log('New hair color: ', body.hairColor)
//     console.log('New body URN: ', body.bodyShapeUrn)
//   })
// }

// Add these variables to track previous states
let lastWearableCheckTime = 0
const CHECK_INTERVAL = 3 // Check every 3 seconds
let previousWearables: string[] | null = null
let previousEmotes: string[] | null = null
let previousEyesColor: Color3 | null = null
let previousSkinColor: Color3 | null = null
let previousHairColor: Color3 | null = null
let previousBodyShapeUrn: string | undefined = undefined

export function wearableBodyCheckSystem(dt: number) {
  lastWearableCheckTime += dt
  if (lastWearableCheckTime < CHECK_INTERVAL) return // Early exit if not time yet

  const player = getPlayer()
  if (!player) {
    console.log('[WEARABLE_CHECK] No player data available')
    return
  }

  const playerId = player.userId
  console.log(`[WEARABLE_CHECK] Checking wearables and body for player ${playerId}`)

  // Get current states
  const currentWearables = player.wearables || []
  const currentEmotes = player.emotes || []
  const currentEyesColor = player.avatar?.eyesColor
  const currentSkinColor = player.avatar?.skinColor
  const currentHairColor = player.avatar?.hairColor
  const currentBodyShapeUrn = player.avatar?.bodyShapeUrn

  console.log(getPlayer()?.wearables)
  console.log(AvatarEquippedData.get(engine.PlayerEntity).wearableUrns)

  // Debug log current states only on first run or when changes occur
  if (previousWearables === null) {
    console.log(`[WEARABLE_CHECK] Initial wearables: ${JSON.stringify(currentWearables)}`)
    console.log(`[WEARABLE_CHECK] Initial emotes: ${JSON.stringify(currentEmotes)}`)
    console.log(
      `[WEARABLE_CHECK] Initial eyes color: ${currentEyesColor ? JSON.stringify(currentEyesColor) : 'undefined'}`
    )
    console.log(
      `[WEARABLE_CHECK] Initial skin color: ${currentSkinColor ? JSON.stringify(currentSkinColor) : 'undefined'}`
    )
    console.log(
      `[WEARABLE_CHECK] Initial hair color: ${currentHairColor ? JSON.stringify(currentHairColor) : 'undefined'}`
    )
    console.log(`[WEARABLE_CHECK] Initial body shape: ${currentBodyShapeUrn || 'undefined'}`)

    // Initialize previous states
    previousWearables = [...currentWearables]
    previousEmotes = [...currentEmotes]
    previousEyesColor = currentEyesColor
      ? Color3.create(currentEyesColor.r, currentEyesColor.g, currentEyesColor.b)
      : null
    previousSkinColor = currentSkinColor
      ? Color3.create(currentSkinColor.r, currentSkinColor.g, currentSkinColor.b)
      : null
    previousHairColor = currentHairColor
      ? Color3.create(currentHairColor.r, currentHairColor.g, currentHairColor.b)
      : null
    previousBodyShapeUrn = currentBodyShapeUrn
  }

  // Compare wearables
  if (!arraysEqual(previousWearables, currentWearables)) {
    console.log(`[WEARABLE_CHANGE] Player ${playerId} wearables changed to: ${JSON.stringify(currentWearables)}`)
    previousWearables = [...currentWearables]
  }

  // Compare emotes
  if (previousEmotes && currentEmotes && !arraysEqual(previousEmotes, currentEmotes)) {
    console.log(`[WEARABLE_CHANGE] Player ${playerId} emotes changed to: ${JSON.stringify(currentEmotes)}`)
    previousEmotes = [...currentEmotes]
  }

  // Compare body attributes
  if (currentEyesColor && previousEyesColor && !Color3.equals(previousEyesColor, currentEyesColor)) {
    console.log(`[WEARABLE_CHANGE] Player ${playerId} eyes color changed to: ${JSON.stringify(currentEyesColor)}`)
    previousEyesColor = Color3.create(currentEyesColor.r, currentEyesColor.g, currentEyesColor.b)
  }

  if (currentSkinColor && previousSkinColor && !Color3.equals(previousSkinColor, currentSkinColor)) {
    console.log(`[WEARABLE_CHANGE] Player ${playerId} skin color changed to: ${JSON.stringify(currentSkinColor)}`)
    previousSkinColor = Color3.create(currentSkinColor.r, currentSkinColor.g, currentSkinColor.b)
  }

  if (currentHairColor && previousHairColor && !Color3.equals(previousHairColor, currentHairColor)) {
    console.log(`[WEARABLE_CHANGE] Player ${playerId} hair color changed to: ${JSON.stringify(currentHairColor)}`)
    previousHairColor = Color3.create(currentHairColor.r, currentHairColor.g, currentHairColor.b)
  }

  if (currentBodyShapeUrn !== previousBodyShapeUrn) {
    console.log(`[WEARABLE_CHANGE] Player ${playerId} body shape changed to: ${currentBodyShapeUrn}`)
    previousBodyShapeUrn = currentBodyShapeUrn
  }

  // Reset timer
  lastWearableCheckTime = 0
}

// Helper function to compare arrays
function arraysEqual(arr1: string[], arr2: string[]): boolean {
  if (arr1.length !== arr2.length) return false
  return arr1.every((item, index) => item === arr2[index])
}
