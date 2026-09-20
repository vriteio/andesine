import {
  API_VERSION,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_BULK_ITEMS,
  MAX_SEARCH_RESULTS
} from "#backend/lib/api/limits";
import type { instanceInfoType } from "#backend/contracts/schemas/instance";
import type * as z from "zod";
import { config } from "#backend/lib/config";
import { getAssetStorageLimit } from "#backend/lib/assets/quota";
import { withAuthorization } from "#backend/lib/policy";

const getInstance = withAuthorization<
  Record<never, never>,
  undefined,
  z.infer<typeof instanceInfoType>
>({}, async ({ auth }) => ({
  apiVersion: API_VERSION,
  features: {
    imageStorage: Boolean(config.ASSET_S3_BUCKET),
    semanticSearch: Boolean(
      config.TYPESENSE_URL &&
      config.TYPESENSE_API_KEY &&
      config.OPENAI_API_KEY &&
      config.SEARCH_EMBEDDING_MODEL
    ),
    aiAnswers: Boolean(
      config.TYPESENSE_URL &&
      config.TYPESENSE_API_KEY &&
      config.OPENAI_API_KEY &&
      config.SEARCH_EMBEDDING_MODEL &&
      config.SEARCH_ASK_MODEL
    ),
    aiAnswerStreaming: Boolean(
      config.TYPESENSE_URL &&
      config.TYPESENSE_API_KEY &&
      config.OPENAI_API_KEY &&
      config.SEARCH_EMBEDDING_MODEL &&
      config.SEARCH_ASK_MODEL
    )
  },
  limits: {
    maxUploadBytes: config.ASSET_MAX_UPLOAD_BYTES,
    assetStorageBytes: getAssetStorageLimit(auth.subscriptionPlan),
    defaultPageSize: DEFAULT_PAGE_SIZE,
    maxPageSize: MAX_PAGE_SIZE,
    maxBulkItems: MAX_BULK_ITEMS,
    maxSearchResults: MAX_SEARCH_RESULTS
  }
}));

export { getInstance };
