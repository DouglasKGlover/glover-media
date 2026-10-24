import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

let documentClient: DynamoDBDocumentClient | undefined
let eventBridgeClient: EventBridgeClient | undefined

export function getDynamoTableName() {
  const tableName = String(useRuntimeConfig().dynamodbTableName || '')
  if (!tableName) {
    throw createError({ statusCode: 503, statusMessage: 'DynamoDB is not configured' })
  }
  return tableName
}

export function getDynamoDocumentClient() {
  documentClient ??= DynamoDBDocumentClient.from(new DynamoDBClient({}))
  return documentClient
}

export async function publishCatalogChanged() {
  const config = useRuntimeConfig()
  const busName = String(config.catalogEventBusName || '')
  if (!busName) {
    throw createError({ statusCode: 503, statusMessage: 'Catalog publishing is not configured' })
  }

  eventBridgeClient ??= new EventBridgeClient({})
  const result = await eventBridgeClient.send(new PutEventsCommand({
    Entries: [{
      EventBusName: busName,
      Source: 'glover.media.catalog',
      DetailType: 'CatalogChanged',
      Detail: JSON.stringify({ changedAt: new Date().toISOString() }),
    }],
  }))

  if (result.FailedEntryCount) {
    throw createError({
      statusCode: 503,
      statusMessage: 'The catalog was saved, but its static-site rebuild could not be queued',
    })
  }
}
