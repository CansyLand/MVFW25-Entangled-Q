import { engine, Schemas } from '@dcl/sdk/ecs'

// Define the NPC component schema
const npcSchema = {
  playerId: Schemas.String, // Use Schemas.String for the playerId field
  npcId: Schemas.Number, // Add npcId as a number field
  isInfluenced: Schemas.Boolean // Add isInfluenced as a boolean field
}

// Define default values (optional)
const npcDefaultValues = {
  playerId: 'undefined', // Default to 'undefined' (not bound)
  npcId: 0, // Default to 0 (will be overridden when creating NPCs)
  isInfluenced: false // Default to false (not influenced)
}

// Define the component
export const npcComponent = engine.defineComponent('npcComponent', npcSchema, npcDefaultValues)
