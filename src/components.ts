import { engine, Schemas } from '@dcl/sdk/ecs'

// Define the NPC component schema
const npcSchema = {
  playerId: Schemas.String // Use Schemas.String for the playerId field
}

// Define default values (optional)
const npcDefaultValues = {
  playerId: 'undefined' // Default to null (not bound)
}

// Define the component
export const npcComponent = engine.defineComponent('npcComponent', npcSchema, npcDefaultValues)
